import { StrictMode, lazy, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"

import Layout from "./components/Layout"
import Home from "./pages/Home"
import "./index.css"

const AiCrm = lazy(() => import("./pages/AiCrm"))
const AutoReply = lazy(() => import("./pages/AutoReply"))
const Quotes = lazy(() => import("./pages/Quotes"))
const FollowUps = lazy(() => import("./pages/FollowUps"))
const Calls = lazy(() => import("./pages/Calls"))
const About = lazy(() => import("./pages/About"))
const Blog = lazy(() => import("./pages/Blog"))
const Careers = lazy(() => import("./pages/Careers"))
const Contact = lazy(() => import("./pages/Contact"))
const Privacy = lazy(() => import("./pages/Privacy"))
const Terms = lazy(() => import("./pages/Terms"))
const Security = lazy(() => import("./pages/Security"))
const FormStudio = lazy(() => import("./pages/FormStudio"))

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="product/ai-crm" element={<AiCrm />} />
            <Route path="product/auto-reply" element={<AutoReply />} />
            <Route path="product/quotes" element={<Quotes />} />
            <Route path="product/follow-ups" element={<FollowUps />} />
            <Route path="product/calls" element={<Calls />} />
            <Route path="about" element={<About />} />
            <Route path="blog" element={<Blog />} />
            <Route path="careers" element={<Careers />} />
            <Route path="contact" element={<Contact />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="security" element={<Security />} />
            <Route path="features/forms" element={<FormStudio />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
