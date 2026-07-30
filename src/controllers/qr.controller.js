import { getQRByCode } from "../services/qr.service.js";

const scanQR = async (req, res) => {
    try {
        const { code } = req.params;
        const qr = await getQRByCode(code);
    
        res.status(200).json({
            gutendex_id: qr.gutendex_id,
            location_name: qr.location_name,
            redirect_to: `/books/${qr.gutendex_id}`,
        });
    } catch (error) {
        if (error.message === 'QR no encontrado' || error.message === 'QR inactivo') {
            return res.status(404).json({
                message: error.message,
                redirect_to: "/catalog"
            });
        }
        res.status(500).json({message: "Error interno del servidor"});
    }
};

export { scanQR };