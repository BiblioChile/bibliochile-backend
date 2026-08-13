import { saveProgress, getProgress, syncProgress } from "../services/progress.service.js";

const saveReadingProgress = async (req, res) => {
  try {
    const { bookId, progressPercentage, lastPosition, anonymousUuid } = req.body;
    const userId = req.user?.id ?? null;

    const progress = await saveProgress({
      userId,
      anonymousUuid: userId ? null : anonymousUuid,
      bookId,
      progressPercentage,
      lastPosition,
    });

    res.status(200).json(progress);
  } catch (error) {
    if (error.message === "Se requiere user_id o anonymous_uuid") {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === "Libro no encontrado") {
      return res.status(404).json({ message: error.message });
    }
    if (
      error.message === "No se pudo sincronizar el libro para guardar el progreso" ||
      error.message === "No se pudo guardar el progreso"
    ) {
      return res.status(502).json({ message: error.message });
    }
    res.status(500).json({ message: "Error interno al guardar el progreso" });
  }
};

const getReadingProgress = async (req, res) => {
  try {
    const userId = req.user?.id ?? null;
    const { anonymousUuid } = req.query;

    if (!userId && !anonymousUuid) {
      return res.status(400).json({ message: "Se requiere autenticación o anonymousUuid" });
    }

    const progress = await getProgress({
      userId,
      anonymousUuid: userId ? null : anonymousUuid,
    });

    res.status(200).json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const syncReadingProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { anonymousUuid } = req.body;

    if (!anonymousUuid) {
      return res.status(400).json({ message: "anonymous_uuid es requerido" });
    }

    const result = await syncProgress(userId, anonymousUuid);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { saveReadingProgress, getReadingProgress, syncReadingProgress };