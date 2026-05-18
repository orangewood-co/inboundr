import { Outlet, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { useScroll, useMotionValueEvent } from "motion/react"
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
  const [width, setWidth] = useState(0)

  useMotionValueEvent(scrollYProgress, "change", (v) => setWidth(v))

  return (
    <div
      id="scroll-progress"
      style={{ width: `${width * 100}%` }}
    />
  )
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
