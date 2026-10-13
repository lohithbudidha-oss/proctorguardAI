import { Router } from 'express';
import { createSupportTicket } from '../controllers/supportController';

const router = Router();

// Public route to submit a support ticket from Contact Support Desk
router.post('/', createSupportTicket);

export default router;
