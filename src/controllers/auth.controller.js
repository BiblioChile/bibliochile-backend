import { register, login } from "../services/auth.service.js";

const registerUser = async (req, res) => {
  try {
    const user = await register(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const data = await login(req.body);
    res.status(200).json(data);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

export { registerUser, loginUser };