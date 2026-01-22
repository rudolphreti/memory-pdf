import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Container,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Step,
  StepLabel,
  Stepper,
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

const layoutOptions: LayoutOption[] = [4, 6, 8];
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
const steps = ["Bilder", "Zuschneiden", "Layout & PDF"];
const defaultCrop: ImageCrop = { x: 0, y: 0, zoom: 1, rotation: 0 };
const dpi = 300;
const a4WidthMm = 210;
const a4HeightMm = 297;
const marginMm = 10;
const gutterMm = 4;

const layoutConfig: Record<LayoutOption, { rows: number; cols: number }> = {
  4: { rows: 2, cols: 2 },
  6: { rows: 3, cols: 2 },
  8: { rows: 4, cols: 2 },
};

function createEmptyProject(): Project {
  return {
    id: crypto.randomUUID(),
    name: "Neues Projekt",
    createdAt: new Date().toISOString(),
    note: "",
    layout: 4,
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

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const previewUrlsRef = useRef<Record<string, string>>({});
  const [activeStep, setActiveStep] = useState(0);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!project) {
      return;
    }

    if (!selectedImageId && project.images.length > 0) {
      setSelectedImageId(project.images[0].id);
      return;
    }

    if (selectedImageId) {
      const stillExists = project.images.some(
        (image) => image.id === selectedImageId
      );
      if (!stillExists) {
        setSelectedImageId(project.images[0]?.id ?? null);
      }
    }
  }, [project, selectedImageId]);

  useEffect(() => {
    if (!project) {
      return;
    }

    const maxStep = project.images.length === 0 ? 0 : steps.length - 1;
    if (activeStep > maxStep) {
      setActiveStep(maxStep);
    }
  }, [project, activeStep]);

  const createdAtLabel = useMemo(() => {
    if (!project) {
      return "";
    }

    return formatDate(project.createdAt);
  }, [project]);

  const selectedImage = useMemo(() => {
    if (!project || !selectedImageId) {
      return null;
    }

    return project.images.find((image) => image.id === selectedImageId) ?? null;
  }, [project, selectedImageId]);

  const maxStep = project
    ? project.images.length === 0
      ? 0
      : steps.length - 1
    : 0;

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

  const handleLayoutChange = (value: LayoutOption) => {
    if (!project) {
      return;
    }

    setProject({ ...project, layout: value });
  };

  const handleAddImages = (files: FileList | null) => {
    if (!project || !files) {
      return;
    }

    const nextImages: ProjectImage[] = Array.from(files)
      .filter((file) => acceptedTypes.includes(file.type))
      .map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        blob: file,
        crop: { ...defaultCrop },
      }));

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

  const handleCropComplete = (
    id: string,
    cropAreaPixels: CropAreaPixels
  ) => {
    handleCropUpdate(id, { cropAreaPixels });
  };

  const handleStepChange = (nextStep: number) => {
    if (!project) {
      return;
    }

    const maxStep = project.images.length === 0 ? 0 : steps.length - 1;
    setActiveStep(Math.min(Math.max(nextStep, 0), maxStep));
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
      layout: project.layout,
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
      layout: imported.layout ?? 4,
      images,
    };

    await saveProject(restored);
    setProject(restored);
    setActiveStep(restored.images.length === 0 ? 0 : 1);

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
      const { rows, cols } = layoutConfig[project.layout];
      const availableWidth = a4WidthMm - 2 * marginMm - gutterMm * (cols - 1);
      const availableHeight =
        a4HeightMm - 2 * marginMm - gutterMm * (rows - 1);
      const cellWidth = availableWidth / cols;
      const cellHeight = availableHeight / rows;
      const cardSizeMm = Math.min(cellWidth, cellHeight);
      const cardSizePx = mmToPx(cardSizeMm);

      const pairedImages = project.images.flatMap((image) => [image, image]);
      const pdfDoc = await PDFDocument.create();

      for (let index = 0; index < pairedImages.length; index += project.layout) {
        const page = pdfDoc.addPage([
          mmToPt(a4WidthMm),
          mmToPt(a4HeightMm),
        ]);
        const slice = pairedImages.slice(index, index + project.layout);

        for (let cardIndex = 0; cardIndex < slice.length; cardIndex += 1) {
          const image = slice[cardIndex];
          const row = Math.floor(cardIndex / cols);
          const col = cardIndex % cols;

          const xMm =
            marginMm +
            col * (cellWidth + gutterMm) +
            (cellWidth - cardSizeMm) / 2;
          const yMm =
            marginMm +
            (rows - 1 - row) * (cellHeight + gutterMm) +
            (cellHeight - cardSizeMm) / 2;

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
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
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
          <Button
            variant="outlined"
            color="inherit"
            onClick={handleExportProject}
          >
            Export (.json)
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            component="label"
          >
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

      <Container sx={{ py: 4 }} maxWidth="lg">
        <Stack spacing={4}>
          <Card variant="outlined">
            <CardContent>
              <Stepper activeStep={activeStep} alternativeLabel>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
            <CardActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
              <Button
                variant="outlined"
                onClick={() => handleStepChange(activeStep - 1)}
                disabled={activeStep === 0}
              >
                Zurück
              </Button>
              <Button
                variant="contained"
                onClick={() => handleStepChange(activeStep + 1)}
                disabled={activeStep >= maxStep}
              >
                Weiter
              </Button>
            </CardActions>
          </Card>

          {activeStep === 0 && (
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
                    minRows={3}
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
                    accept={acceptedTypes.join(",")}
                    onChange={(event) => {
                      handleAddImages(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary">
                  Unterstützt: JPG, PNG, WEBP. Bilder werden sofort gespeichert.
                </Typography>
              </CardActions>
            </Card>
          )}

          {activeStep === 0 && (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">
                    Bildübersicht ({project.images.length})
                  </Typography>
                  {project.images.length === 0 ? (
                    <Typography variant="body1" color="text.secondary">
                      Noch keine Bilder. Füge oben Dateien hinzu.
                    </Typography>
                  ) : (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 2,
                      }}
                    >
                      {project.images.map((image) => (
                        <Card key={image.id} variant="outlined">
                          <CardMedia
                            component="img"
                            height="140"
                            image={previewUrls[image.id]}
                            alt={image.name}
                            sx={{ objectFit: "cover" }}
                          />
                          <CardContent>
                            <Typography variant="subtitle2" noWrap>
                              {image.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {(image.size / 1024).toFixed(1)} KB
                            </Typography>
                          </CardContent>
                          <CardActions sx={{ justifyContent: "flex-end" }}>
                            <IconButton
                              aria-label="Bild entfernen"
                              onClick={() => handleRemoveImage(image.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </CardActions>
                        </Card>
                      ))}
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {activeStep === 1 && (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={3}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={3}
                    alignItems="stretch"
                  >
                    <Stack spacing={2} sx={{ minWidth: 240 }}>
                      <Typography variant="h6">Bilder auswählen</Typography>
                      {project.images.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Füge zuerst Bilder hinzu.
                        </Typography>
                      ) : (
                        <Stack spacing={1}>
                          {project.images.map((image) => (
                            <Button
                              key={image.id}
                              variant={
                                image.id === selectedImageId
                                  ? "contained"
                                  : "outlined"
                              }
                              onClick={() => setSelectedImageId(image.id)}
                              sx={{ justifyContent: "flex-start", gap: 1 }}
                            >
                              <Box
                                component="img"
                                src={previewUrls[image.id]}
                                alt={image.name}
                                sx={{
                                  width: 48,
                                  height: 48,
                                  objectFit: "cover",
                                  borderRadius: 1,
                                }}
                              />
                              <Typography variant="body2" noWrap>
                                {image.name}
                              </Typography>
                            </Button>
                          ))}
                        </Stack>
                      )}
                    </Stack>

                    <Stack spacing={2} sx={{ flex: 1 }}>
                      <Typography variant="h6">Zuschneiden (Quadrat)</Typography>
                      {selectedImage ? (
                        <>
                          <Box
                            sx={{
                              position: "relative",
                              width: "100%",
                              maxWidth: 520,
                              aspectRatio: "1 / 1",
                              bgcolor: "grey.900",
                              borderRadius: 2,
                              overflow: "hidden",
                            }}
                          >
                            <Cropper
                              image={previewUrls[selectedImage.id]}
                              crop={{
                                x: selectedImage.crop?.x ?? defaultCrop.x,
                                y: selectedImage.crop?.y ?? defaultCrop.y,
                              }}
                              zoom={selectedImage.crop?.zoom ?? defaultCrop.zoom}
                              rotation={
                                selectedImage.crop?.rotation ??
                                defaultCrop.rotation
                              }
                              aspect={1}
                              onCropChange={(crop) =>
                                handleCropUpdate(selectedImage.id, crop)
                              }
                              onZoomChange={(zoom) =>
                                handleCropUpdate(selectedImage.id, { zoom })
                              }
                              onRotationChange={(rotation) =>
                                handleCropUpdate(selectedImage.id, { rotation })
                              }
                              onCropComplete={(_, cropAreaPixels) =>
                                handleCropComplete(
                                  selectedImage.id,
                                  cropAreaPixels
                                )
                              }
                            />
                          </Box>
                          <Stack spacing={2} sx={{ maxWidth: 520 }}>
                            <Box>
                              <Typography gutterBottom>
                                Zoom (
                                {(
                                  selectedImage.crop?.zoom ?? defaultCrop.zoom
                                ).toFixed(2)}
                                x)
                              </Typography>
                              <Slider
                                min={1}
                                max={3}
                                step={0.05}
                                value={
                                  selectedImage.crop?.zoom ?? defaultCrop.zoom
                                }
                                onChange={(_, value) =>
                                  handleCropUpdate(selectedImage.id, {
                                    zoom: value as number,
                                  })
                                }
                              />
                            </Box>
                            <Box>
                              <Typography gutterBottom>
                                Rotation (
                                {selectedImage.crop?.rotation ??
                                  defaultCrop.rotation}
                                °)
                              </Typography>
                              <Slider
                                min={-180}
                                max={180}
                                step={1}
                                value={
                                  selectedImage.crop?.rotation ??
                                  defaultCrop.rotation
                                }
                                onChange={(_, value) =>
                                  handleCropUpdate(selectedImage.id, {
                                    rotation: value as number,
                                  })
                                }
                              />
                            </Box>
                          </Stack>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Wähle links ein Bild aus, um den Zuschnitt zu
                          bearbeiten.
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {activeStep === 2 && (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={3}>
                  <Typography variant="h6">Layout &amp; PDF</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel id="layout-label">
                        Layout (Karten pro Seite)
                      </InputLabel>
                      <Select
                        labelId="layout-label"
                        value={project.layout}
                        label="Layout (Karten pro Seite)"
                        onChange={(event) =>
                          handleLayoutChange(
                            event.target.value as LayoutOption
                          )
                        }
                      >
                        {layoutOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option} Karten ({layoutConfig[option].cols}x
                            {layoutConfig[option].rows})
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
                      {isExportingPdf
                        ? "PDF wird erzeugt..."
                        : "PDF exportieren"}
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      A4 Hochformat · Ränder 10mm · Gutter 4mm · 300 DPI
                    </Typography>
                  </Stack>
                  {project.images.length > 0 && (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 2,
                      }}
                    >
                      {project.images.map((image) => (
                        <Card key={image.id} variant="outlined">
                          <CardMedia
                            component="img"
                            height="120"
                            image={previewUrls[image.id]}
                            alt={image.name}
                            sx={{ objectFit: "cover" }}
                          />
                          <CardContent>
                            <Typography variant="subtitle2" noWrap>
                              {image.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Zuschnitt gespeichert
                            </Typography>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
