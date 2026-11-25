// Vitest setup file of the `dom` project (`softureVitestConfig({ dom: true })`): unmounts what a test rendered, so
// the next test starts from an empty document. Testing Library registers this itself only when `afterEach` is a
// global (`globals: true`).
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
