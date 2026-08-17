"use client";
/* eslint-disable @next/next/no-img-element -- Camera previews use a local data URL. */

import Link from "next/link";
import { ArrowLeft, Camera, Check, Languages, RefreshCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/app/lib/use-language";

const copy = {
  zh: { titleIn: "拍摄签到自拍", titleOut: "拍摄签退自拍", hint: "请正对镜头并确保光线充足", allow: "需要相机权限以完成现场记录", noCamera: "无法打开相机，请检查浏览器权限后重试。", capture: "拍照", retake: "重拍", submitIn: "提交签到", submitOut: "提交签退", privacy: "照片将安全保存至私有存储", language: "English", preview: "照片预览", uploading: "正在安全提交…", submitError: "提交失败，请重试。照片尚未保存。" },
  en: { titleIn: "Take a check-in selfie", titleOut: "Take a check-out selfie", hint: "Face the camera and make sure the light is good", allow: "Camera access is required for your field record", noCamera: "We could not open the camera. Check browser permissions and try again.", capture: "Take photo", retake: "Retake", submitIn: "Submit check in", submitOut: "Submit check out", privacy: "Your photo will be saved to private storage", language: "中文", preview: "Photo preview", uploading: "Submitting securely…", submitError: "Submission failed. Your photo was not saved. Try again." },
} as const;

function CameraExperience() {
  const params = useSearchParams();
  const router = useRouter();
  const { locale, toggleLanguage } = useLanguage();
  const t = copy[locale];
  const eventType = params.get("type") === "out" ? "out" : "in";
  const project = params.get("project") || "adidas";
  const projectName = params.get("project_name") || "Project site";
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [captureTime, setCaptureTime] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<"loading" | "ready" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let live = true;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (!live) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState("ready");
      } catch {
        if (live) setCameraState("error");
      }
    }
    startCamera();
    return () => {
      live = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/webp", .82));
    setCaptureTime(new Date().toISOString());
    setSubmitError("");
  }

  function retake() { setPhoto(null); setCaptureTime(null); setSubmitError(""); }

  async function submitPhoto() {
    if (!photo || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const blob = await fetch(photo).then((response) => response.blob());
      const body = new FormData();
      body.set("photo", new File([blob], "selfie.webp", { type: "image/webp" }));
      body.set("client_capture_time", captureTime || new Date().toISOString());
      if (eventType === "in") body.set("project_id", project);
      const response = await fetch(`/api/attendance/check-${eventType}`, { method: "POST", body });
      const result = await response.json() as { event?: { record_code?: string; server_timestamp?: string }; session?: { duration_seconds?: number }; error?: string };
      if (!response.ok || !result.event) throw new Error(result.error || "SUBMIT_FAILED");
      const query = new URLSearchParams({ type: eventType, project, project_name: projectName, lang: locale, record: result.event.record_code || "", time: result.event.server_timestamp || "" });
      if (result.session?.duration_seconds != null) query.set("duration", String(result.session.duration_seconds));
      router.replace(`/worker/success?${query.toString()}`);
    } catch {
      setSubmitError(t.submitError);
      setSubmitting(false);
    }
  }

  return (
    <main className="camera-page">
      <header className="camera-topbar">
        <Link href={eventType === "out" ? "/worker?state=working" : "/worker"} aria-label="Back"><ArrowLeft size={21} /></Link>
        <strong>现场通 <span>OnSite</span></strong>
        <button type="button" onClick={toggleLanguage}><Languages size={16} />{t.language}</button>
      </header>

      <section className="camera-content">
        <div className="camera-heading">
          <p>{eventType === "out" ? "CHECK OUT" : "CHECK IN"} · 02/03</p>
          <h1>{eventType === "out" ? t.titleOut : t.titleIn}</h1>
          <span>{t.hint}</span>
        </div>

        <div className={`camera-viewport ${photo ? "has-photo" : ""}`}>
          {cameraState === "loading" && !photo && <div className="camera-loading"><span /><p>{t.allow}</p></div>}
          {cameraState === "error" && !photo && <div className="camera-error"><TriangleAlert size={32} /><p>{t.noCamera}</p></div>}
          <video ref={videoRef} muted playsInline aria-label="Live front camera" />
          {photo && <img src={photo} alt={t.preview} />}
          <div className="camera-guide" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="camera-watermark"><span>现场通 ONSITE</span><small>{projectName}</small></div>
        </div>
        <canvas ref={canvasRef} hidden />

        {!photo ? (
          <button className="shutter" type="button" onClick={capture} disabled={cameraState !== "ready"} aria-label={t.capture}><span><Camera size={25} /></span><strong>{t.capture}</strong></button>
        ) : (
          <div className="camera-submit-row">
            <button className="retake-button" type="button" onClick={retake}><RefreshCcw size={18} />{t.retake}</button>
            <button className="submit-photo" type="button" onClick={submitPhoto} disabled={submitting}><Check size={19} />{submitting ? t.uploading : eventType === "out" ? t.submitOut : t.submitIn}</button>
          </div>
        )}
        {submitError && <p className="camera-submit-error" role="alert">{submitError}</p>}
        <p className="camera-privacy"><ShieldCheck size={15} />{t.privacy}</p>
      </section>
    </main>
  );
}

export default function CameraPage() {
  return <Suspense><CameraExperience /></Suspense>;
}
