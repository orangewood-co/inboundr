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
const Press = lazy(() => import("./pages/Press"))
const PressRelease = lazy(() => import("./pages/PressRelease"))
const Careers = lazy(() => import("./pages/Careers"))
const Contact = lazy(() => import("./pages/Contact"))
const Privacy = lazy(() => import("./pages/Privacy"))
const Terms = lazy(() => import("./pages/Terms"))
const Security = lazy(() => import("./pages/Security"))
const Subprocessors = lazy(() => import("./pages/Subprocessors"))
const Features = lazy(() => import("./pages/Features"))
const FormStudio = lazy(() => import("./pages/FormStudio"))
const Links = lazy(() => import("./pages/Links"))
const Drive = lazy(() => import("./pages/Drive"))
const Employees = lazy(() => import("./pages/Employees"))
const Invoices = lazy(() => import("./pages/Invoices"))
const Support = lazy(() => import("./pages/Support"))
const Assets = lazy(() => import("./pages/Assets"))
const NotFound = lazy(() => import("./pages/NotFound"))

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
            <Route path="press" element={<Press />} />
            <Route path="press/:slug" element={<PressRelease />} />
            <Route path="careers" element={<Careers />} />
            <Route path="contact" element={<Contact />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="security" element={<Security />} />
            <Route path="subprocessors" element={<Subprocessors />} />
            <Route path="features" element={<Features />} />
            <Route path="features/forms" element={<FormStudio />} />
            <Route path="features/links" element={<Links />} />
            <Route path="features/drive" element={<Drive />} />
            <Route path="features/employees" element={<Employees />} />
            <Route path="features/invoices" element={<Invoices />} />
            <Route path="features/support" element={<Support />} />
            <Route path="features/assets" element={<Assets />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
