"use client";
// CaseApp — top-level client state of the single page (ADR 003 §3.1, §3.2). Owns the reducer,
// performs the two API calls and switches between form, processing and chat screens.
import { useReducer, useRef, useState } from "react";
import type { CaseInput } from "@/lib/shared";
import { AppHeader } from "./AppHeader";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProcessingPanel } from "./ProcessingPanel";
import { createCase, decideCase } from "./api/client";
import { caseAppReducer, createInitialState, type ApiFailure } from "./case-app-reducer";
import { ChatScreen } from "./chat/ChatScreen";
import { CaseForm } from "./form/CaseForm";

const UNEXPECTED_MESSAGE = "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.";

/** `ApiError` is structurally an `ApiFailure`; anything else becomes a generic failure. */
function toFailure(error: unknown): ApiFailure {
  if (error && typeof error === "object" && "status" in error && "message" in error) return error as ApiFailure;
  return { status: 0, message: UNEXPECTED_MESSAGE };
}

export function CaseApp() {
  const [state, dispatch] = useReducer(caseAppReducer, undefined, createInitialState);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Last valid submission: a retry without `pendingCaseId` re-submits exactly this. */
  const lastSubmission = useRef<{ values: CaseInput; photo: File } | null>(null);

  async function runDecision(caseId: string) {
    try {
      const { decision, firstMessage } = await decideCase(caseId);
      dispatch({ type: "DECISION_SUCCEEDED", decision, firstMessage });
    } catch (error) {
      dispatch({ type: "DECISION_FAILED", error: toFailure(error) });
    }
  }

  async function submit(values: CaseInput, photo: File) {
    lastSubmission.current = { values, photo };
    dispatch({ type: "SUBMIT" });
    let created;
    try {
      created = await createCase(values, photo);
    } catch (error) {
      dispatch({ type: "CASE_FAILED", error: toFailure(error) });
      return;
    }
    dispatch({ type: "CASE_CREATED", created });
    await runDecision(created.caseId);
  }

  function retry() {
    if (state.status !== "editing") return;
    if (state.pendingCaseId && state.pendingCreated) {
      dispatch({ type: "RETRY_DECISION" });
      void runDecision(state.pendingCaseId);
      return;
    }
    const last = lastSubmission.current;
    if (last) void submit(last.values, last.photo);
  }

  function confirmNewCase() {
    if (state.status === "chat" && state.photoPreviewUrl) URL.revokeObjectURL(state.photoPreviewUrl);
    lastSubmission.current = null;
    setConfirmOpen(false);
    dispatch({ type: "RESET" });
  }

  return (
    <>
      <AppHeader onNewCase={state.status === "chat" ? () => setConfirmOpen(true) : undefined} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        {state.status === "chat" ? (
          <ChatScreen
            key={state.caseId}
            caseId={state.caseId}
            caseSummary={state.caseSummary}
            analysis={state.analysis}
            assessment={state.assessment}
            decision={state.decision}
            firstMessage={state.firstMessage}
            photoPreviewUrl={state.photoPreviewUrl}
            onNewCase={() => setConfirmOpen(true)}
          />
        ) : state.status === "deciding" ? (
          <ProcessingPanel stage={2} />
        ) : (
          <div className="mx-auto flex max-w-[640px] flex-col gap-6">
            <CaseForm
              values={state.values}
              photo={state.photo}
              fieldErrors={state.fieldErrors}
              bannerError={state.bannerError}
              onRetry={retry}
              disabled={state.status === "analyzing"}
              onValuesChange={(patch) => dispatch({ type: "EDIT_VALUES", patch })}
              onPhotoChange={(photo) => dispatch({ type: "PHOTO_CHANGED", photo })}
              onSubmit={(values, photo) => void submit(values, photo)}
            />
            {state.status === "analyzing" ? <ProcessingPanel stage={1} /> : null}
          </div>
        )}
      </main>
      <ConfirmDialog open={confirmOpen} onCancel={() => setConfirmOpen(false)} onConfirm={confirmNewCase} />
    </>
  );
}
