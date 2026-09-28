import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MiniAudioPlayer } from "@/components/audio/MiniAudioPlayer";

/**
 * Public layout — wraps all public-facing pages with site chrome.
 * Admin and auth routes live outside this group and do not get this layout.
 *
 * MiniAudioPlayer is placed here (not in the locale root layout) so admin
 * pages don't render the audio bar. It is a fixed overlay so it does not
 * affect document flow regardless of where it is rendered.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {/* pb-20 reserves space so the MiniAudioPlayer does not overlap content */}
      <main className="flex-1 pb-20">{children}</main>
      <Footer />
      <MiniAudioPlayer />
    </>
  );
}
