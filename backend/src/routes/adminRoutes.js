"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const examController_1 = require("../controllers/examController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const User_1 = require("../models/User");
const router = (0, express_1.Router)();
// Apply auth and admin check to all admin routes
router.use(authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)([User_1.Role.ADMIN]));
router.get('/candidates', adminController_1.getCandidates);
router.patch('/candidates/:id/status', adminController_1.updateCandidateStatus);
router.post('/exams', examController_1.createExam);
router.get('/exams', examController_1.getExams);
router.patch('/exams/:id', examController_1.updateExam);
router.post('/exams/:id/publish', examController_1.publishExam);
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map