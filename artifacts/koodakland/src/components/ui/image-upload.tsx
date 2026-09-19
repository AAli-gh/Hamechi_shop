import { useRef, useState } from "react";
import { Upload, X, Loader2, Star } from "lucide-react";
import { imageUrl } from "@/lib/utils";

interface ImageUploadProps {
  /** Uploaded image URLs; the first one is the main image. */
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  label?: string;
}

type Pending = { id: string; preview: string; name: string };

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "same-origin" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "آپلود انجام نشد");
  return data.url as string;
}

export function ImageUpload({ value, onChange, maxFiles = 8, label = "آپلود تصویر" }: ImageUploadProps) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Uploads finish one by one; keep the latest list so none overwrites another.
  const latest = useRef(value);
  latest.current = value;

  const processFiles = async (fileList: File[]) => {
    const room = maxFiles - value.length - pending.length;
    const toUpload = fileList.filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (toUpload.length === 0) return;
    setErrors([]);
    const items = toUpload.map((file) => ({ file, id: `${Date.now()}-${Math.random()}`, preview: URL.createObjectURL(file), name: file.name }));
    setPending((p) => [...p, ...items]);

    for (const item of items) {
      try {
        const url = await uploadFile(item.file);
        latest.current = [...latest.current, url];
        onChange(latest.current);
      } catch (error) {
        setErrors((e) => [...e, `${item.name}: ${(error as Error).message}`]);
      } finally {
        URL.revokeObjectURL(item.preview);
        setPending((p) => p.filter((x) => x.id !== item.id));
      }
    }
  };

  const remove = (url: string) => onChange(value.filter((u) => u !== url));
  const makeMain = (url: string) => onChange([url, ...value.filter((u) => u !== url)]);
  const canAdd = value.length + pending.length < maxFiles;

  return (
    <div className="flex flex-col gap-3">
      {canAdd && (
        <button
          type="button"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); processFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed transition-colors select-none ${
            dragging ? "border-primary bg-primary/10" : "border-primary/25 bg-primary/5 hover:border-primary/60"
          }`}
        >
          <Upload className="w-6 h-6 text-primary" />
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">فایل را اینجا رها کنید یا کلیک کنید — JPG، PNG، WEBP تا ۵ مگابایت</span>
          <span className="text-xs text-muted-foreground">{value.length.toLocaleString("fa-IR")} از {maxFiles.toLocaleString("fa-IR")} تصویر</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) processFiles(Array.from(e.target.files)); e.target.value = ""; }}
          />
        </button>
      )}

      {errors.length > 0 && (
        <ul className="text-xs text-destructive flex flex-col gap-0.5" role="alert">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}

      {(value.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((url, i) => (
            <li key={url} className="relative group aspect-square rounded-xl overflow-hidden bg-muted border border-border">
              <img src={imageUrl(url, 160)} alt="" className="w-full h-full object-cover" />
              {i === 0 ? (
                <span className="absolute bottom-1 right-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">اصلی</span>
              ) : (
                <button type="button" onClick={() => makeMain(url)} title="تصویر اصلی شود" aria-label="تصویر اصلی شود"
                  className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                  <Star className="w-3 h-3" />
                </button>
              )}
              <button type="button" onClick={() => remove(url)} title="حذف" aria-label="حذف تصویر"
                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-500 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border">
              <img src={p.preview} alt="" className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
