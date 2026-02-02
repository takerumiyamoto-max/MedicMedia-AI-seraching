import { Router } from "express";
import pdfs from "./pdfs";
// import health from "./health"; // あるなら

const router = Router();

// router.use("/health", health);
router.use("/pdfs", pdfs);

export default router;