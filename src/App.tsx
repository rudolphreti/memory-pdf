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
import type { ImageCrop, LayoutOption, Project, ProjectImage } from "./types";
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

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const previewUrlsRef = useRef<Record<string, string>>({});
  const [activeStep, setActiveStep] = useState(0);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

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

  const handleStepChange = (nextStep: number) => {
    if (!project) {
      return;
    }

    const maxStep = project.images.length === 0 ? 0 : steps.length - 1;
    setActiveStep(Math.min(Math.max(nextStep, 0), maxStep));
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
                        gridTemplateColumns: `repeat(${project.layout}, minmax(0, 1fr))`,
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
                        Layout (Spalten)
                      </InputLabel>
                      <Select
                        labelId="layout-label"
                        value={project.layout}
                        label="Layout (Spalten)"
                        onChange={(event) =>
                          handleLayoutChange(
                            event.target.value as LayoutOption
                          )
                        }
                      >
                        {layoutOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
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
                  <Typography variant="body1" color="text.secondary">
                    PDF-Erstellung folgt in einem späteren Schritt. Der aktuelle
                    Fokus liegt auf der Bildauswahl und dem quadratischen
                    Zuschnitt.
                  </Typography>
                  {project.images.length > 0 && (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${project.layout}, minmax(0, 1fr))`,
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
