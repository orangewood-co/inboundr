import { Outlet, useLocation } from "react-router-dom"
import { useEffect } from "react"
import { motion, useScroll } from "motion/react"
import Header from "./Header"
import Footer from "./Footer"

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll()

  return <motion.div id="scroll-progress" style={{ scaleX: scrollYProgress }} />
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-base text-text">
      <ScrollProgress />
      <ScrollToTop />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
