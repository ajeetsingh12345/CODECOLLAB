import "./globals.css";
import { Providers } from "../redux/Providers";

export const metadata = {
  title: "CodeCollab",
  description: "Collaborative code snippet sharing and review platform"
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
