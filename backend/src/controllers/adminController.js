"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCandidateStatus = exports.getCandidates = void 0;
const express_1 = require("express");
const User_1 = __importStar(require("../models/User"));
const getCandidates = async (req, res, next) => {
    try {
        const statusFilter = req.query.status;
        const query = { role: User_1.Role.CANDIDATE };
        if (statusFilter) {
            query.status = statusFilter;
        }
        const candidates = await User_1.default.find(query).select('-passwordHash').sort({ createdAt: -1 });
        res.status(200).json({ success: true, candidates });
    }
    catch (err) {
        next(err);
    }
};
exports.getCandidates = getCandidates;
const updateCandidateStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!Object.values(User_1.CandidateStatus).includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }
        const candidate = await User_1.default.findById(id);
        if (!candidate || candidate.role !== User_1.Role.CANDIDATE) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }
        candidate.status = status;
        await candidate.save();
        // TODO: Send email notification (e.g. Approved, Rejected)
        res.status(200).json({ success: true, message: `Candidate status updated to ${status}`, candidate: {
                id: candidate._id,
                name: candidate.name,
                email: candidate.email,
                status: candidate.status
            } });
    }
    catch (err) {
        next(err);
    }
};
exports.updateCandidateStatus = updateCandidateStatus;
//# sourceMappingURL=adminController.js.map