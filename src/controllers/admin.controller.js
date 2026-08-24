import {
    listManagedBooks,
    createQRCode,
    listQRCodes,
    toggleQRCode,
    listPendingAuthors,
    approveAuthor,
    rejectAuthor,
} from "../services/admin.service.js";

const getManagedBooks = async (req, res) => {
    try {
        const books = await listManagedBooks();
        res.status(200).json(books);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const postQRCode = async (req, res) => {
    try {
        const { locationName, gutendexId } = req.body;
        const qr = await createQRCode(locationName, gutendexId, req.user.id);
        res.status(201).json(qr);
    } catch (error) {
        if (error.message === "El libro de Gutendex no existe") {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
};

const getQRCodes = async (req, res) => {
    try {
        const qrCodes = await listQRCodes();
        res.status(200).json(qrCodes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const patchQRCode = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const qr = await toggleQRCode(id);
        res.status(200).json(qr);
    } catch (error) {
        if (error.message === "QR no encontrado") {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
};

const getPendingAuthors = async (req, res) => {
    try {
        const authors = await listPendingAuthors();
        res.status(200).json(authors);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const patchApproveAuthor = async (req, res) => {
    try {
        const authorId = Number(req.params.id);
        const author = await approveAuthor(authorId);
        res.status(200).json(author);
    } catch (error) {
        if (error.message === "Autor no encontrado") {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
};

const patchRejectAuthor = async (req, res) => {
    try {
        const authorId = Number(req.params.id);
        const { reason, note } = req.body;
        const author = await rejectAuthor(authorId, reason, note);
        res.status(200).json(author);
    } catch (error) {
        if (error.message === "Autor no encontrado") {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
};

export {
    getManagedBooks,
    postQRCode,
    getQRCodes,
    patchQRCode,
    getPendingAuthors,
    patchApproveAuthor,
    patchRejectAuthor,
};
