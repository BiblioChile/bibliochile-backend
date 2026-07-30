import { saveProgress, syncProgress } from "../services/progress.service.js";

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

export { saveReadingProgress, syncReadingProgress };