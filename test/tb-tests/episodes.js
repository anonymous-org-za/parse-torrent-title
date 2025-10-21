// The Office (US) (2005) Season 1-9 S01-S09 (1080p BluRay x265 HEVC 10bit AAC 5.1 Silence) [QxR]
const { expect } = require("chai");
const parse = require("../../index").parse;

describe("Parsing episodes", () => {
    it("should not detect episodes", () => {
        const releaseName = "The Office (US) (2005) Season 1-9 S01-S09 (1080p BluRay x265 HEVC 10bit AAC 5.1 Silence) [QxR]";

        expect(parse(releaseName).episodes).to.be.equal(undefined);
    });
    it("should not detect episodes", () => {
        const releaseName = "Osiemznakow (2020) Season 1-9 S01-S09 (1080p BluRay x265 HEVC 10bit AAC 5.1 Silence) [QxR]";

        expect(parse(releaseName).episodes).to.be.equal(undefined);
    });
});
