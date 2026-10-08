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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.login = exports.verifyEmail = exports.register = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importStar(require("../models/User"));
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_replace_in_production';
const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        const existingUser = await User_1.default.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email already in use' });
        }
        const passwordHash = await bcrypt_1.default.hash(password, 12);
        // If first user, make them ADMIN
        const isFirstUser = (await User_1.default.countDocuments()) === 0;
        const role = isFirstUser ? User_1.Role.ADMIN : User_1.Role.CANDIDATE;
        const status = isFirstUser ? User_1.CandidateStatus.APPROVED : User_1.CandidateStatus.PENDING_VERIFICATION;
        const user = new User_1.default({ name, email, passwordHash, role, status });
        await user.save();
        // TODO: Send verification email here if role is CANDIDATE
        res.status(201).json({
            success: true,
            message: 'Registration successful. Please verify your email.',
            user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status }
        });
    }
    catch (err) {
        next(err);
    }
};
exports.register = register;
const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.body;
        // For MVP, we can simulate token validation or decode JWT email token
        // Example: verify token -> find user -> update status to VERIFIED
        res.status(200).json({ success: true, message: 'Email verified. Awaiting admin approval.' });
    }
    catch (err) {
        next(err);
    }
};
exports.verifyEmail = verifyEmail;
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        const user = await User_1.default.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const isValidPassword = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isValidPassword) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        // Role specific checks
        if (user.role === User_1.Role.CANDIDATE && user.status === User_1.CandidateStatus.PENDING_VERIFICATION) {
            return res.status(403).json({ success: false, message: 'Please verify your email first' });
        }
        if (user.role === User_1.Role.CANDIDATE && (user.status === User_1.CandidateStatus.SUSPENDED || user.status === User_1.CandidateStatus.DEACTIVATED)) {
            return res.status(403).json({ success: false, message: 'Account is suspended or deactivated' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user._id, role: user.role, status: user.status }, JWT_SECRET, { expiresIn: '8h' });
        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status }
        });
    }
    catch (err) {
        next(err);
    }
};
exports.login = login;
const logout = async (req, res, next) => {
    try {
        // In stateless JWT, client deletes token. For stateful, we'd invalidate it here.
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    }
    catch (err) {
        next(err);
    }
};
exports.logout = logout;
//# sourceMappingURL=authController.js.map