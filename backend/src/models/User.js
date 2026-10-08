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
exports.CandidateStatus = exports.Role = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var Role;
(function (Role) {
    Role["CANDIDATE"] = "CANDIDATE";
    Role["ADMIN"] = "ADMIN";
    Role["PROCTOR"] = "PROCTOR";
})(Role || (exports.Role = Role = {}));
var CandidateStatus;
(function (CandidateStatus) {
    CandidateStatus["PENDING_VERIFICATION"] = "PENDING_VERIFICATION";
    CandidateStatus["VERIFIED"] = "VERIFIED";
    CandidateStatus["APPROVED"] = "APPROVED";
    CandidateStatus["SUSPENDED"] = "SUSPENDED";
    CandidateStatus["DEACTIVATED"] = "DEACTIVATED";
})(CandidateStatus || (exports.CandidateStatus = CandidateStatus = {}));
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(Role), default: Role.CANDIDATE },
    status: { type: String, enum: Object.values(CandidateStatus), default: CandidateStatus.PENDING_VERIFICATION },
    emailVerifiedAt: { type: Date },
}, { timestamps: true });
exports.default = mongoose_1.default.model('User', UserSchema);
//# sourceMappingURL=User.js.map