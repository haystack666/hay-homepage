import { motion } from 'motion/react'
import { siteConfig } from '../../site.config'

export function AboutSection() {
  return (
    <motion.section
      className="home-section about-section"
      id="about"
      data-signal-reveal
      initial={{ y: 28 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.72, ease: 'easeOut' }}
    >
      <div className="section-marker" aria-hidden="true">
        <span>02</span>
        <span className="section-marker-line" />
      </div>
      <div className="about-copy">
        <p className="section-label">About Haystack</p>
        <p className="about-statement">{siteConfig.about}</p>
      </div>
      <p className="about-aside">
        A place for experiments, shipped tools, and the thinking between them.
      </p>
    </motion.section>
  )
}
