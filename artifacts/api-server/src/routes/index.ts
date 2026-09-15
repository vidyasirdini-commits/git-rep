import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quickcartRouter from "./quickcart";

const router: IRouter = Router();

router.use(healthRouter);
router.use(quickcartRouter);

export default router;
