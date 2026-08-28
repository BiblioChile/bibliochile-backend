import { getBooks, getBookById, getPaidBooks } from "../services/book.service.js";

const getAllBooks = async (req, res) => {
  try {
    const { search, genre, page } = req.query;
    const data = await getBooks({ search, genre, page });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBook = async (req, res) => {
  try {
    const { id } = req.params;
    const book = await getBookById(id);
    res.status(200).json(book);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const getAllPaidBooks = async (req, res) => {
  try {
    const data = await getPaidBooks();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { getAllBooks, getBook, getAllPaidBooks };