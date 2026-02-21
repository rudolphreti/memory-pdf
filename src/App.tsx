import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Container,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import Cropper from "react-easy-crop";
import { PDFDocument } from "pdf-lib";
import type {
  CropAreaPixels,
  ImageCrop,
  LayoutOption,
  Project,
  ProjectImage,
} from "./types";
import {
  getLastProjectId,
  getMostRecentProject,
  getProject,
  saveProject,
} from "./db";

const acceptedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/avif",
  "image/svg+xml",
  "image/tiff",
];
const acceptedExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".avif",
  ".svg",
  ".tif",
  ".tiff",
];
const extensionToMimeType: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
};
const defaultCrop: ImageCrop = { x: 0, y: 0, zoom: 1, rotation: 0 };
const dpi = 300;
const layoutValue: LayoutOption = 6;

const layoutConfig: Record<
  LayoutOption,
  {
    label: string;
    pageWidthMm: number;
    pageHeightMm: number;
    cardSizeMm: number;
    rows: number;
    cols: number;
    stripWidthMm: number;
  }
> = {
  6: {
    label: "6 Karten (2x3) + Streifen 12mm",
    pageWidthMm: 210,
    pageHeightMm: 297,
    cardSizeMm: 99,
    rows: 3,
    cols: 2,
    stripWidthMm: 12,
  },
  12: {
    label: "12 Karten (4x3) A4 quer + Streifen 17mm",
    pageWidthMm: 297,
    pageHeightMm: 210,
    cardSizeMm: 70,
    rows: 3,
    cols: 4,
    stripWidthMm: 17,
  },
};

const layoutOptions = Object.keys(layoutConfig).map((value) =>
  Number(value)
) as LayoutOption[];

function isLayoutOption(value: unknown): value is LayoutOption {
  return layoutOptions.includes(value as LayoutOption);
}

function getFileExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }

  return name.slice(dotIndex).toLowerCase();
}

function normalizeImageType(file: File): string | null {
  if (acceptedMimeTypes.includes(file.type)) {
    return file.type;
  }

  const extension = getFileExtension(file.name);
  if (!acceptedExtensions.includes(extension)) {
    return null;
  }

  return extensionToMimeType[extension] ?? null;
}

function createEmptyProject(): Project {
  return {
    id: crypto.randomUUID(),
    name: "Neues Projekt",
    createdAt: new Date().toISOString(),
    note: "",
    layout: layoutValue,
    images: [],
  };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mmToPx(mm: number): number {
  return Math.round((mm / 25.4) * dpi);
}

function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (event) => reject(event));
    image.src = url;
  });
}

function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180;
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) +
      Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) +
      Math.abs(Math.cos(rotRad) * height),
  };
}

async function renderCroppedImage(
  image: ProjectImage,
  outputSizePx: number
): Promise<Blob> {
  const imageUrl = URL.createObjectURL(image.blob);
  const htmlImage = await createImage(imageUrl);
  URL.revokeObjectURL(imageUrl);

  const cropAreaPixels =
    image.crop?.cropAreaPixels ??
    (() => {
      const minSize = Math.min(htmlImage.width, htmlImage.height);
      return {
        x: (htmlImage.width - minSize) / 2,
        y: (htmlImage.height - minSize) / 2,
        width: minSize,
        height: minSize,
      } satisfies CropAreaPixels;
    })();

  const rotation = image.crop?.rotation ?? 0;
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    htmlImage.width,
    htmlImage.height,
    rotation
  );

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context ist nicht verfügbar.");
  }

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(getRadianAngle(rotation));
  ctx.translate(-htmlImage.width / 2, -htmlImage.height / 2);
  ctx.drawImage(htmlImage, 0, 0);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputSizePx;
  outputCanvas.height = outputSizePx;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) {
    throw new Error("Canvas context ist nicht verfügbar.");
  }

  outputCtx.drawImage(
    canvas,
    cropAreaPixels.x,
    cropAreaPixels.y,
    cropAreaPixels.width,
    cropAreaPixels.height,
    0,
    0,
    outputSizePx,
    outputSizePx
  );

  return new Promise((resolve, reject) => {
    outputCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Konnte Bild nicht exportieren."));
      }
    }, "image/png");
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Konnte Base64 nicht lesen."));
        return;
      }
      const base64 = result.split(",")[1];
      resolve(base64 ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}

interface ExportedProjectImage {
  id: string;
  name: string;
  type: string;
  crop?: ImageCrop;
  data: string;
}

interface ExportedProject {
  id: string;
  name: string;
  createdAt: string;
  note: string;
  layout: LayoutOption;
  images: ExportedProjectImage[];
}

interface CropTileCardProps {
  image: ProjectImage;
  previewUrl: string;
  handleCropUpdate: (id: string, cropUpdate: Partial<ImageCrop>) => void;
  handleCropComplete: (id: string, cropAreaPixels: CropAreaPixels) => void;
  handleRemoveImage: (id: string) => void;
  setProject: Dispatch<SetStateAction<Project | null>>;
}

function CropTileCard({
  image,
  previewUrl,
  handleCropUpdate,
  handleCropComplete,
  handleRemoveImage,
  setProject,
}: CropTileCardProps) {
  const cropAreaRef = useRef<HTMLDivElement | null>(null);
  const [cropSize, setCropSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const node = cropAreaRef.current;
    if (!node) {
      return;
    }

    const updateSize = () => {
      const nextWidth = Math.floor(node.clientWidth);
      const nextHeight = Math.floor(node.clientHeight);
      setCropSize((previous) => {
        if (
          previous.width === nextWidth &&
          previous.height === nextHeight
        ) {
          return previous;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  return (
    <Card key={image.id} variant="outlined">
      <Box
        ref={cropAreaRef}
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          bgcolor: "common.white",
          overflow: "hidden",
        }}
      >
        <IconButton
          aria-label="Bild entfernen"
          onClick={() => handleRemoveImage(image.id)}
          size="small"
          sx={{
            position: "absolute",
            top: 6,
            right: 6,
            zIndex: 2,
            bgcolor: "rgba(255,255,255,0.9)",
            "&:hover": { bgcolor: "rgba(255,255,255,1)" },
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
        {cropSize.width > 0 && cropSize.height > 0 && (
          <Cropper
            image={previewUrl}
            crop={{
              x: image.crop?.x ?? defaultCrop.x,
              y: image.crop?.y ?? defaultCrop.y,
            }}
            cropSize={cropSize}
            zoom={image.crop?.zoom ?? defaultCrop.zoom}
            minZoom={0.2}
            rotation={image.crop?.rotation ?? defaultCrop.rotation}
            aspect={1}
            objectFit="contain"
            onCropChange={(crop) => handleCropUpdate(image.id, crop)}
            onZoomChange={(zoom) => handleCropUpdate(image.id, { zoom })}
            onRotationChange={(rotation) =>
              handleCropUpdate(image.id, { rotation })
            }
            onCropComplete={(_, cropAreaPixels) =>
              handleCropComplete(image.id, cropAreaPixels)
            }
            onInteractionStart={() => {
              setProject((previous) => {
                if (!previous) {
                  return previous;
                }

                return {
                  ...previous,
                  images: previous.images.map((currentImage) =>
                    currentImage.id === image.id
                      ? {
                          ...currentImage,
                          crop: {
                            ...defaultCrop,
                            ...currentImage.crop,
                            zoom: Math.max(
                              0.2,
                              currentImage.crop?.zoom ?? defaultCrop.zoom
                            ),
                          },
                        }
                      : currentImage
                  ),
                };
              });
            }}
          />
        )}
      </Box>
      <CardContent sx={{ p: 1 }}>
        <Typography variant="caption" noWrap display="block">
          {image.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Rotation ({Math.round(image.crop?.rotation ?? defaultCrop.rotation)}°)
        </Typography>
        <Slider
          size="small"
          min={-180}
          max={180}
          step={1}
          value={image.crop?.rotation ?? defaultCrop.rotation}
          onChange={(_, value) =>
            handleCropUpdate(image.id, {
              rotation: value as number,
            })
          }
        />
      </CardContent>
    </Card>
  );
}

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const previewUrlsRef = useRef<Record<string, string>>({});
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const lastProjectId = await getLastProjectId();
      let loaded = lastProjectId ? await getProject(lastProjectId) : null;

      if (!loaded) {
        loaded = await getMostRecentProject();
      }

      if (!loaded) {
        loaded = createEmptyProject();
        await saveProject(loaded);
      }

      setProject(loaded);
      setIsLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    if (!project || isLoading) {
      return;
    }

    saveProject(project);
  }, [project, isLoading]);

  useEffect(() => {
    if (!project) {
      return;
    }

    const current = previewUrlsRef.current;
    const next: Record<string, string> = {};

    for (const image of project.images) {
      if (current[image.id]) {
        next[image.id] = current[image.id];
      } else {
        next[image.id] = URL.createObjectURL(image.blob);
      }
    }

    for (const id of Object.keys(current)) {
      if (!next[id]) {
        URL.revokeObjectURL(current[id]);
      }
    }

    previewUrlsRef.current = next;
    setPreviewUrls(next);
  }, [project]);

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  const createdAtLabel = useMemo(() => {
    if (!project) {
      return "";
    }

    return formatDate(project.createdAt);
  }, [project]);

  const selectedLayout = useMemo(() => {
    if (!project) {
      return layoutConfig[layoutValue];
    }

    return layoutConfig[project.layout];
  }, [project]);

  const handleCreateNew = () => {
    const nextProject = createEmptyProject();
    setProject(nextProject);
  };

  const handleNameChange = (value: string) => {
    if (!project) {
      return;
    }

    setProject({ ...project, name: value });
  };

  const handleNoteChange = (value: string) => {
    if (!project) {
      return;
    }

    setProject({ ...project, note: value });
  };

  const handleAddImages = (files: FileList | null) => {
    if (!project || !files) {
      return;
    }

    const nextImages: ProjectImage[] = [];
    for (const file of Array.from(files)) {
      const type = normalizeImageType(file);
      if (!type) {
        continue;
      }

      nextImages.push({
        id: crypto.randomUUID(),
        name: file.name,
        type,
        size: file.size,
        blob: file,
        crop: { ...defaultCrop },
      });
    }

    if (nextImages.length === 0) {
      return;
    }

    setProject({
      ...project,
      images: [...project.images, ...nextImages],
    });
  };

  const handleRemoveImage = (id: string) => {
    if (!project) {
      return;
    }

    setProject({
      ...project,
      images: project.images.filter((image) => image.id !== id),
    });
  };

  const handleCropUpdate = (id: string, cropUpdate: Partial<ImageCrop>) => {
    if (!project) {
      return;
    }

    setProject({
      ...project,
      images: project.images.map((image) =>
        image.id === id
          ? { ...image, crop: { ...defaultCrop, ...image.crop, ...cropUpdate } }
          : image
      ),
    });
  };

  const handleCropComplete = (id: string, cropAreaPixels: CropAreaPixels) => {
    handleCropUpdate(id, { cropAreaPixels });
  };

  const handleLayoutChange = (layout: LayoutOption) => {
    if (!project) {
      return;
    }

    setProject({ ...project, layout });
  };

  const handleExportProject = async () => {
    if (!project) {
      return;
    }

    const images: ExportedProjectImage[] = [];
    for (const image of project.images) {
      const data = await blobToBase64(image.blob);
      images.push({
        id: image.id,
        name: image.name,
        type: image.type,
        crop: image.crop,
        data,
      });
    }

    const exportedProject: ExportedProject = {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      note: project.note,
      layout: layoutValue,
      images,
    };

    const payload = JSON.stringify(exportedProject, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProject = async (file: File | null) => {
    if (!file) {
      return;
    }

    const text = await file.text();
    const imported = JSON.parse(text) as ExportedProject;

    const images: ProjectImage[] = imported.images.map((image) => {
      const blob = base64ToBlob(image.data, image.type);
      return {
        id: image.id,
        name: image.name,
        type: image.type,
        size: blob.size,
        blob,
        crop: image.crop,
      };
    });

    const restored: Project = {
      id: imported.id ?? crypto.randomUUID(),
      name: imported.name ?? "Importiertes Projekt",
      createdAt: imported.createdAt ?? new Date().toISOString(),
      note: imported.note ?? "",
      layout: isLayoutOption(imported.layout) ? imported.layout : layoutValue,
      images,
    };

    await saveProject(restored);
    setProject(restored);

    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
  };

  const handleExportPdf = async () => {
    if (!project || project.images.length === 0) {
      return;
    }

    setIsExportingPdf(true);
    try {
      const {
        cardSizeMm,
        cols: layoutCols,
        rows: layoutRows,
        pageWidthMm,
        pageHeightMm,
      } = selectedLayout;
      const cardsPerPage = layoutRows * layoutCols;
      const cardSizePx = mmToPx(cardSizeMm);

      const pairedImages = project.images.flatMap((image) => [image, image]);
      const pdfDoc = await PDFDocument.create();

      for (let index = 0; index < pairedImages.length; index += cardsPerPage) {
        const page = pdfDoc.addPage([mmToPt(pageWidthMm), mmToPt(pageHeightMm)]);
        const slice = pairedImages.slice(index, index + cardsPerPage);

        for (let cardIndex = 0; cardIndex < slice.length; cardIndex += 1) {
          const image = slice[cardIndex];
          const row = Math.floor(cardIndex / layoutCols);
          const col = cardIndex % layoutCols;

          const xMm = col * cardSizeMm;
          const yMm = (layoutRows - 1 - row) * cardSizeMm;

          const croppedBlob = await renderCroppedImage(image, cardSizePx);
          const imageBytes = await croppedBlob.arrayBuffer();
          const embedded = await pdfDoc.embedPng(imageBytes);

          page.drawImage(embedded, {
            x: mmToPt(xMm),
            y: mmToPt(yMm),
            width: mmToPt(cardSizeMm),
            height: mmToPt(cardSizeMm),
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Uint8Array.from(pdfBytes).buffer;
      const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.name.replace(/\s+/g, "_")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (isLoading || !project) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <Typography variant="h6">Projekt wird geladen...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50" }}>
      <AppBar position="static" color="primary">
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Memory PDF Projektmanager
          </Typography>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<NoteAddIcon />}
            onClick={handleCreateNew}
          >
            Neues Projekt
          </Button>
          <Button variant="outlined" color="inherit" onClick={handleExportProject}>
            Export (.json)
          </Button>
          <Button variant="outlined" color="inherit" component="label">
            Import (.json)
            <input
              ref={importInputRef}
              hidden
              type="file"
              accept="application/json"
              onChange={(event) =>
                handleImportProject(event.target.files?.[0] ?? null)
              }
            />
          </Button>
        </Toolbar>
      </AppBar>

      <Container sx={{ py: 4 }} maxWidth={false}>
        <Stack spacing={3}>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={3}>
                <TextField
                  label="Projektname"
                  value={project.name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Notiz"
                  value={project.note}
                  onChange={(event) => handleNoteChange(event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="Erstellt am"
                    value={createdAtLabel}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                  <TextField
                    label="Bildanzahl"
                    value={project.images.length}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                </Stack>
              </Stack>
            </CardContent>
            <CardActions sx={{ px: 2, pb: 2 }}>
              <Button
                variant="contained"
                component="label"
                startIcon={<AddPhotoAlternateIcon />}
              >
                Bilder hinzufügen
                <input
                  hidden
                  type="file"
                  multiple
                  accept={[...acceptedMimeTypes, ...acceptedExtensions].join(",")}
                  onChange={(event) => {
                    handleAddImages(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </Button>
              <Typography variant="body2" color="text.secondary">
                Unterstützt: JPG/JPEG, PNG, WEBP, GIF, BMP, AVIF, SVG, TIFF.
              </Typography>
            </CardActions>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">
                  Zuschneidbare Kacheln ({project.images.length})
                </Typography>
                {project.images.length === 0 ? (
                  <Typography variant="body1" color="text.secondary">
                    Noch keine Bilder. Füge oben Dateien hinzu.
                  </Typography>
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "repeat(2, minmax(0, 1fr))",
                        sm: "repeat(3, minmax(0, 1fr))",
                        md: "repeat(4, minmax(0, 1fr))",
                        lg: "repeat(6, minmax(0, 1fr))",
                        xl: "repeat(8, minmax(0, 1fr))",
                      },
                      gap: 1,
                    }}
                  >
                    {project.images.map((image) => (
                      <CropTileCard
                        key={image.id}
                        image={image}
                        previewUrl={previewUrls[image.id]}
                        handleCropUpdate={handleCropUpdate}
                        handleCropComplete={handleCropComplete}
                        handleRemoveImage={handleRemoveImage}
                        setProject={setProject}
                      />
                    ))}
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">PDF</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <FormControl fullWidth>
                    <InputLabel id="layout-label">Layout</InputLabel>
                    <Select
                      labelId="layout-label"
                      label="Layout"
                      value={project.layout}
                      onChange={(event) =>
                        handleLayoutChange(event.target.value as LayoutOption)
                      }
                    >
                      {layoutOptions.map((layoutOption) => (
                        <MenuItem key={layoutOption} value={layoutOption}>
                          {layoutConfig[layoutOption].label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Bilder im Projekt"
                    value={project.images.length}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button
                    variant="contained"
                    onClick={handleExportPdf}
                    disabled={project.images.length === 0 || isExportingPdf}
                  >
                    {isExportingPdf ? "PDF wird erzeugt..." : "PDF exportieren"}
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    {`A4 ${selectedLayout.pageWidthMm}×${selectedLayout.pageHeightMm}mm · ${selectedLayout.cols}×${selectedLayout.rows} · ${selectedLayout.cardSizeMm}mm · Streifen ${selectedLayout.stripWidthMm}mm · 300 DPI`}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
