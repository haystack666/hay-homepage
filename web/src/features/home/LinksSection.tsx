import { motion } from 'motion/react'
import { siteConfig } from '../../site.config'

export function LinksSection() {
  return (
    <motion.section
      className="home-section links-section"
      id="links"
      data-signal-reveal
      initial={{ y: 28 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.72, ease: 'easeOut' }}
    >
      <div className="section-marker" aria-hidden="true">
        <span>03</span>
        <span className="section-marker-line" />
      </div>
      <div className="links-main">
        <p className="section-label">Find Haystack</p>
        <h2>Good things are usually a conversation away.</h2>
        <div className="link-list">
          {siteConfig.links.map((link) => (
            <a
              className="contact-link"
              href={link.href}
              key={link.label}
              rel={link.external ? 'noopener noreferrer' : undefined}
              target={link.external ? '_blank' : undefined}
            >
              <span>{link.label}</span>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
