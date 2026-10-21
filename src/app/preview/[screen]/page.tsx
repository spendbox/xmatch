import { notFound } from "next/navigation";
import { PreviewScreen } from "./PreviewScreen";

// Design preview with sample data. Never available on the live site.
export default async function Preview({ params }: { params: Promise<{ screen: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PREVIEW !== "1") notFound();
  const { screen } = await params;
  return <PreviewScreen screen={screen} />;
}
