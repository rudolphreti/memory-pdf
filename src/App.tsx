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
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import type { LayoutOption, Project, ProjectImage } from "./types";
import {
  getLastProjectId,
  getMostRecentProject,
  getProject,
  saveProject,
} from "./db";

const layoutOptions: LayoutOption[] = [4, 6, 8];
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

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
                  <FormControl fullWidth>
                    <InputLabel id="layout-label">Layout (Spalten)</InputLabel>
                    <Select
                      labelId="layout-label"
                      value={project.layout}
                      label="Layout (Spalten)"
                      onChange={(event) =>
                        handleLayoutChange(event.target.value as LayoutOption)
                      }
                    >
                      {layoutOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
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
        </Stack>
      </Container>
    </Box>
  );
}
