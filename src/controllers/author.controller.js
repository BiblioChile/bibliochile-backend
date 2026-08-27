import { registerAuthor, getAuthorByUserId, uploadBook, getMyStats, getMyAuthorStatus } from "../services/author.service.js";

const register = async (req, res) => {
    try {
        const { rut, bio, declarationAccepted } = req.body;
        const userId = req.user.id;

        const author = await registerAuthor(userId, rut, bio, declarationAccepted);
        res.status(201).json(author);
    } catch (error) {
        if (error.message === "Debes aceptar la declaración jurada") {
            return res.status(422).json({ message: error.message });
        }
        if (error.message === "Ya tienes un registro de autor" || error.message === "El RUT ya está registrado") {
            return res.status(409).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
};

const uploadMyBook = async (req, res) => {
    try {
        const author = await getAuthorByUserId(req.user.id);
        const book = await uploadBook(author.id, req.body);
        res.status(201).json(book);
    } catch (error) {
        if (error.message === "No tienes un registro de autor" || error.message === "Autor no encontrado") {
            return res.status(404).json({ message: error.message });
        }
        if (error.message === "Tu cuenta de autor aún no ha sido aprobada") {
            return res.status(403).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
};

const getMyBookStats = async (req, res) => {
    try {
        const author = await getAuthorByUserId(req.user.id);
        const stats = await getMyStats(author.id);
        res.status(200).json(stats);
    } catch (error) {
        if (error.message === "No tienes un registro de autor" || error.message === "Autor no encontrado") {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
};

const getMyAuthorStatusHandler = async (req, res) => {
    try {
        const result = await getMyAuthorStatus(req.user.id);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export { register, uploadMyBook, getMyBookStats, getMyAuthorStatusHandler };
