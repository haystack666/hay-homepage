import { motion } from 'motion/react'

export function NowSection() {
  return (
    <motion.section
      className="home-section now-section"
      id="now"
      data-signal-reveal
      initial={{ y: 28 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.72, ease: 'easeOut' }}
    >
      <div className="section-marker" aria-hidden="true">
        <span>01</span>
        <span className="section-marker-line" />
      </div>
      <div>
        <p className="section-label">What is moving</p>
        <h2>Building small software with a long half-life.</h2>
        <p className="section-lede">
          Haystack is exploring the space between a useful tool and a quiet daily ritual.
        </p>
      </div>
    </motion.section>
  )
}
