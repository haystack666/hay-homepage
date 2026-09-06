import { motion } from 'motion/react'
import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { siteConfig } from '../../site.config'
import { SignalNode } from './SignalNode'
import { usePointerOrbit } from './usePointerOrbit'

const LazySignalField = lazy(() => import('./SignalField').then(({ SignalField }) => ({ default: SignalField })))

export function SignalPoster() {
  const { containerRef, pointerRef, reducedMotion, style } = usePointerOrbit(true)

  return (
    <section
      className="signal-poster"
      id="top"
      data-testid="signal-poster"
      data-signal-motion={reducedMotion ? 'static' : 'interactive'}
      ref={containerRef}
      style={style}
    >
      <Suspense
        fallback={
          <div
            className="signal-field signal-field-fallback"
            data-testid="signal-field"
            data-signal-field-mode={reducedMotion ? 'static' : 'interactive'}
            aria-hidden="true"
          />
        }
      >
        <LazySignalField pointerRef={pointerRef} reducedMotion={reducedMotion} />
      </Suspense>
      <div className="signal-poster-grid" aria-hidden="true" />
      <div className="signal-orbit signal-orbit-back" aria-hidden="true" />
      <div className="signal-orbit signal-orbit-front" aria-hidden="true" />
      <motion.header
        className="signal-header"
        initial={{ y: -12 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
      >
        <Link className="signal-wordmark" to="/" aria-label="Haystack home">
          <span className="signal-wordmark-dot" aria-hidden="true" />
          HAYSTACK
        </Link>
        <div className="signal-header-meta">
          <span>INDEX / 001</span>
          <span>ONLINE</span>
        </div>
        <nav className="signal-header-nav" aria-label="Page navigation">
          <a href="#about">About</a>
          <a href="#links">Contact</a>
        </nav>
      </motion.header>

      <motion.div
        className="signal-poster-main"
        data-signal-hero
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: { delayChildren: 0.12, staggerChildren: 0.11 },
          },
        }}
      >
        <motion.p
          className="signal-kicker"
          variants={{ hidden: { y: 16 }, visible: { y: 0 } }}
        >
          Independent developer
        </motion.p>
        <motion.h1
          className="signal-title-resolve"
          variants={{ hidden: { y: 22, clipPath: 'inset(0 0 100% 0)' }, visible: { y: 0, clipPath: 'inset(0 0 0% 0)' } }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
        >
          {siteConfig.declaration}
        </motion.h1>
        <motion.p
          className="signal-intro"
          variants={{ hidden: { y: 14 }, visible: { y: 0 } }}
        >
          Small software, deliberate details, and notes worth keeping.
        </motion.p>
      </motion.div>

      <motion.div
        className="signal-poster-nodes"
        aria-label="Explore Haystack"
        initial={{ y: 22 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.55, duration: 0.7, ease: 'easeOut' }}
      >
        <SignalNode label="NOW" href="#now" detail="What is moving" />
        <SignalNode label="NOTES" href="/notes" detail="Ideas worth keeping" />
        <SignalNode label="LINKS" href="#links" detail="Find Haystack" />
      </motion.div>

      <motion.div
        className="signal-poster-footer"
        initial={{ y: 8 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.8, duration: 0.7, ease: 'easeOut' }}
      >
        <span>HAYSTACK / 2026</span>
        <a href="#now">Scroll to explore <span aria-hidden="true">↓</span></a>
      </motion.div>
    </section>
  )
}
