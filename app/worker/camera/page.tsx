"use client";
/* eslint-disable @next/next/no-img-element -- Camera previews use a local data URL. */

import Link from "next/link";
import { ArrowLeft, Camera, Check, Languages, RefreshCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/app/lib/use-language";
import { getWorkSummaryMetrics, isWorkSummaryValid, WORK_SUMMARY_LIMITS } from "@/lib/work-summary";

const copy = {
  zh: { titleIn: "拍摄签到自拍", titleOut: "拍摄签退自拍", hint: "请正对镜头并确保光线充足", allow: "需要相机权限以完成现场记录", noCamera: "无法打开相机，请检查浏览器权限后重试。", capture: "拍照", retake: "重拍", submitIn: "提交签到", submitOut: "提交签退", privacyIn: "照片将安全保存至私有存储", privacyOut: "照片与工作总结将安全保存至私有存储", language: "English", preview: "照片预览", uploading: "正在安全提交…", submitError: "提交失败，请重试。照片尚未保存。", summaryTitle: "今日工作总结", summaryRequired: "必填", summaryReady: "已满足", summaryHint: "请写明今天完成的工作，例如机器人或设备数量、检修维护、维修结果、备件使用、现场情况或学习内容。", summaryPlaceholder: "例如：今天完成 6 台机器人的例行检查，更换 2 个传感器，并测试运行状态正常。", summaryRule: "满足任一项即可：20 个汉字、10 个英文单词或 40 个有效字符", summaryProgress: (han:number,words:number,chars:number) => `汉字 ${han}/20 · 英文单词 ${words}/10 · 有效字符 ${chars}/40`, summaryError: "请先完成今日工作总结。" },
  en: { titleIn: "Take a check-in selfie", titleOut: "Take a check-out selfie", hint: "Face the camera and make sure the light is good", allow: "Camera access is required for your field record", noCamera: "We could not open the camera. Check browser permissions and try again.", capture: "Take photo", retake: "Retake", submitIn: "Submit check in", submitOut: "Submit check out", privacyIn: "Your photo will be saved to private storage", privacyOut: "Your photo and work summary will be saved to private storage", language: "Español", preview: "Photo preview", uploading: "Submitting securely…", submitError: "Submission failed. Your photo was not saved. Try again.", summaryTitle: "Today's work summary", summaryRequired: "Required", summaryReady: "Ready", summaryHint: "Describe today's completed work: robot or equipment count, inspection, maintenance, repair results, spare parts, site conditions, or learning.", summaryPlaceholder: "Example: Completed inspections on six robots, replaced two sensors, and verified normal operation.", summaryRule: "Meet any one: 20 Chinese characters, 10 English words, or 40 effective characters", summaryProgress: (han:number,words:number,chars:number) => `Chinese ${han}/20 · English words ${words}/10 · Characters ${chars}/40`, summaryError: "Complete today's work summary before submitting." },
  es: { titleIn: "Toma una foto de entrada", titleOut: "Toma una foto de salida", hint: "Mira a la cámara y asegúrate de tener buena iluminación", allow: "Se necesita acceso a la cámara para completar el registro", noCamera: "No pudimos abrir la cámara. Revisa los permisos del navegador.", capture: "Tomar foto", retake: "Repetir", submitIn: "Registrar entrada", submitOut: "Registrar salida", privacyIn: "La foto se guardará de forma segura en almacenamiento privado", privacyOut: "La foto y el resumen se guardarán de forma segura", language: "한국어", preview: "Vista previa de la foto", uploading: "Enviando de forma segura…", submitError: "No se pudo enviar. La foto no se guardó. Inténtalo de nuevo.", summaryTitle: "Resumen del trabajo de hoy", summaryRequired: "Obligatorio", summaryReady: "Listo", summaryHint: "Describe el trabajo completado: cantidad de robots o equipos, inspección, mantenimiento, reparaciones, repuestos, condiciones del sitio o aprendizaje.", summaryPlaceholder: "Ejemplo: Inspeccioné seis robots, reemplacé dos sensores y verifiqué su funcionamiento normal.", summaryRule: "Cumple una opción: 20 caracteres chinos, 10 palabras o 40 caracteres efectivos", summaryProgress: (han:number,words:number,chars:number) => `Chino ${han}/20 · Palabras ${words}/10 · Caracteres ${chars}/40`, summaryError: "Completa el resumen del trabajo antes de enviarlo." },
  ko: { titleIn: "출근 셀카 촬영", titleOut: "퇴근 셀카 촬영", hint: "카메라를 정면으로 보고 밝은 곳에서 촬영하세요", allow: "현장 기록을 완료하려면 카메라 권한이 필요합니다", noCamera: "카메라를 열 수 없습니다. 브라우저 권한을 확인한 후 다시 시도하세요.", capture: "사진 촬영", retake: "다시 촬영", submitIn: "출근 제출", submitOut: "퇴근 제출", privacyIn: "사진은 비공개 저장소에 안전하게 저장됩니다", privacyOut: "사진과 작업 요약은 비공개 저장소에 안전하게 저장됩니다", language: "中文", preview: "사진 미리보기", uploading: "안전하게 제출 중…", submitError: "제출하지 못했습니다. 사진은 저장되지 않았습니다. 다시 시도하세요.", summaryTitle: "오늘의 작업 요약", summaryRequired: "필수", summaryReady: "완료", summaryHint: "오늘 완료한 작업을 작성하세요. 로봇 또는 장비 수량, 점검, 유지보수, 수리 결과, 예비 부품, 현장 상황 또는 학습 내용을 포함할 수 있습니다.", summaryPlaceholder: "예: 로봇 6대를 점검하고 센서 2개를 교체한 후 정상 작동을 확인했습니다.", summaryRule: "다음 중 하나 충족: 한자 20자, 영문 10단어 또는 유효 문자 40자", summaryProgress: (han:number,words:number,chars:number) => `한자 ${han}/20 · 영문 단어 ${words}/10 · 유효 문자 ${chars}/40`, summaryError: "제출하기 전에 오늘의 작업 요약을 작성하세요." },
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
  const [workSummary, setWorkSummary] = useState("");
  const summaryMetrics = getWorkSummaryMetrics(workSummary);
  const summaryValid = isWorkSummaryValid(workSummary);

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
    if (eventType === "out" && !summaryValid) {
      setSubmitError(t.summaryError);
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const blob = await fetch(photo).then((response) => response.blob());
      const body = new FormData();
      body.set("photo", new File([blob], "selfie.webp", { type: "image/webp" }));
      body.set("client_capture_time", captureTime || new Date().toISOString());
      if (eventType === "in") body.set("project_id", project);
      else body.set("daily_work_summary", workSummary.trim());
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
          <>
            {eventType === "out" && <section className={`work-summary-card ${summaryValid ? "valid" : ""}`}>
              <div className="work-summary-heading"><label htmlFor="daily-work-summary">{t.summaryTitle}</label><span>{summaryValid ? <><Check size={13}/>{t.summaryReady}</> : t.summaryRequired}</span></div>
              <p>{t.summaryHint}</p>
              <textarea id="daily-work-summary" value={workSummary} onChange={(event)=>{setWorkSummary(event.target.value);setSubmitError("")}} placeholder={t.summaryPlaceholder} maxLength={WORK_SUMMARY_LIMITS.maximumCharacters} rows={5}/>
              <div className="work-summary-progress"><span>{t.summaryProgress(summaryMetrics.chineseCharacters,summaryMetrics.englishWords,summaryMetrics.effectiveCharacters)}</span><small>{t.summaryRule}</small></div>
            </section>}
            <div className="camera-submit-row">
              <button className="retake-button" type="button" onClick={retake}><RefreshCcw size={18} />{t.retake}</button>
              <button className="submit-photo" type="button" onClick={submitPhoto} disabled={submitting || (eventType === "out" && !summaryValid)}><Check size={19} />{submitting ? t.uploading : eventType === "out" ? t.submitOut : t.submitIn}</button>
            </div>
          </>
        )}
        {submitError && <p className="camera-submit-error" role="alert">{submitError}</p>}
        <p className="camera-privacy"><ShieldCheck size={15} />{eventType === "out" ? t.privacyOut : t.privacyIn}</p>
      </section>
    </main>
  );
}

export default function CameraPage() {
  return <Suspense><CameraExperience /></Suspense>;
}
