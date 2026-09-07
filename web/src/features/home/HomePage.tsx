import { MotionConfig } from 'motion/react'
import { AboutSection } from './AboutSection'
import { LinksSection } from './LinksSection'
import { NowSection } from './NowSection'
import { NotesPreviewLoader } from './NotesPreview'
import { SignalPoster } from './SignalPoster'

export function HomePage() {
  return (
    <MotionConfig reducedMotion="user">
      <main className="home-page" data-testid="home-page">
        <SignalPoster />
        <div className="home-content">
          <NowSection />
          <NotesPreviewLoader />
          <AboutSection />
          <LinksSection />
        </div>
        <footer className="site-footer">
          <span>Haystack / Independent Developer</span>
          <span>{new Date().getFullYear()} / Still building</span>
        </footer>
      </main>
    </MotionConfig>
  )
}
