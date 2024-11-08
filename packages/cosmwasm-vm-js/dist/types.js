"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericError = exports.VoteOption = exports.ReplyOn = void 0;
var ReplyOn;
(function (ReplyOn) {
    ReplyOn["Always"] = "always";
    ReplyOn["Never"] = "never";
    ReplyOn["Success"] = "success";
    ReplyOn["Error"] = "error";
})(ReplyOn || (exports.ReplyOn = ReplyOn = {}));
var VoteOption;
(function (VoteOption) {
    VoteOption[VoteOption["Yes"] = 0] = "Yes";
    VoteOption[VoteOption["No"] = 1] = "No";
    VoteOption[VoteOption["Abstain"] = 2] = "Abstain";
    VoteOption[VoteOption["NoWithVeto"] = 3] = "NoWithVeto";
})(VoteOption || (exports.VoteOption = VoteOption = {}));
// general error like javascript error
class GenericError extends Error {
    constructor(msg) {
        super(`Generic error: ${msg}`);
    }
}
exports.GenericError = GenericError;
//# sourceMappingURL=types.js.map