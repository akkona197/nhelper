import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Undo2,
  Redo2,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
};

async function uploadImage(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("note-images").upload(path, file, {
    contentType: file.type || "image/png",
    upsert: false,
  });
  if (error) {
    toast.error("Không tải được ảnh: " + error.message);
    return null;
  }
  const { data, error: signErr } = await supabase.storage
    .from("note-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr || !data) {
    toast.error("Không tạo được link ảnh");
    return null;
  }
  return data.signedUrl;
}

export function RichEditor({ value, onChange, placeholder, minHeight = 200, autoFocus }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Nhập nội dung..." }),
    ],
    content: value || "",
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none focus:outline-none px-3 py-2 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_h1]:mt-3 [&_h2]:mt-3 [&_img]:rounded-md [&_img]:my-2 [&_img]:max-w-full",
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items || !user) return false;
        for (const it of Array.from(items)) {
          if (it.type.startsWith("image/")) {
            const file = it.getAsFile();
            if (file) {
              event.preventDefault();
              (async () => {
                const url = await uploadImage(user.id, file);
                if (url) {
                  view.dispatch(
                    view.state.tr.replaceSelectionWith(
                      view.state.schema.nodes.image.create({ src: url })
                    )
                  );
                }
              })();
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmitted.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
      lastEmitted.current = value;
    }
  }, [value, editor]);

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user || !editor) return;
    const url = await uploadImage(user.id, file);
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }

  if (!editor) return null;

  return (
    <div className="rounded-md border border-input bg-background overflow-hidden flex flex-col">
      <Toolbar editor={editor} onPickImage={() => fileRef.current?.click()} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
      <div className="overflow-y-auto" style={{ minHeight, maxHeight: 520 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor, onPickImage }: { editor: Editor; onPickImage: () => void }) {
  const Btn = ({
    active,
    onClick,
    title,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={`size-7 inline-flex items-center justify-center rounded hover:bg-secondary transition-colors ${
        active ? "bg-secondary text-primary" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1 bg-secondary/30 flex-wrap">
      <Btn title="Đậm (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-3.5" />
      </Btn>
      <Btn title="Nghiêng (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-3.5" />
      </Btn>
      <Btn title="Gạch ngang" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="size-3.5" />
      </Btn>
      <div className="w-px h-4 bg-border mx-1" />
      <Btn title="Tiêu đề lớn" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="size-3.5" />
      </Btn>
      <Btn title="Tiêu đề nhỏ" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-3.5" />
      </Btn>
      <div className="w-px h-4 bg-border mx-1" />
      <Btn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-3.5" />
      </Btn>
      <Btn title="Danh sách số" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-3.5" />
      </Btn>
      <Btn title="Trích dẫn" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-3.5" />
      </Btn>
      <div className="w-px h-4 bg-border mx-1" />
      <Btn title="Chèn ảnh (hoặc Ctrl+V)" onClick={onPickImage}>
        <ImageIcon className="size-3.5" />
      </Btn>
      <div className="flex-1" />
      <Btn title="Hoàn tác" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="size-3.5" />
      </Btn>
      <Btn title="Làm lại" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="size-3.5" />
      </Btn>
    </div>
  );
}
