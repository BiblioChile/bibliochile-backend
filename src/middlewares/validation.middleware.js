const validate = (schema) => {
  return (req, res, next) => {
    
    const result = schema.safeParse(req.body);

    if (!result.success) {
        const issues = JSON.parse(result.error.message)
        return res.status(422).json({
        message: "Error de validación",
        errors: result.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }

    req.body = result.data;
    next();
  };
};

export { validate };