import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
        color: "#D9F99D",
        background: "#0F4C3A",
        fontSize: 32,
        fontWeight: 900,
      }}
    >
      现
    </div>,
    size,
  );
}
