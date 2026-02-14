export type LayoutOption = 4 | 6 | 8;
export type PdfTemplateOption = "classic" | "a4-landscape-4x3-70mm";

export interface ProjectImage {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  crop?: ImageCrop;
}

export interface ImageCrop {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  note: string;
  layout: LayoutOption;
  pdfTemplate: PdfTemplateOption;
  images: ProjectImage[];
}
