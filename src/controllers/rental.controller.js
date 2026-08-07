import { createRental, getUserRentals } from "../services/rental.service.js";

const rentBook = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookId } = req.body;

    const rental = await createRental(userId, bookId);
    res.status(201).json(rental);
  } catch (error) {
    if (error.message === "No tienes una suscripción activa") {
      return res.status(403).json({ message: error.message });
    }
    if (error.message === "Libro no encontrado") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === "Has alcanzado el límite de arriendos de tu plan") {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

const listMyRentals = async (req, res) => {
  try {
    const rentals = await getUserRentals(req.user.id);
    res.status(200).json(rentals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { rentBook, listMyRentals };
