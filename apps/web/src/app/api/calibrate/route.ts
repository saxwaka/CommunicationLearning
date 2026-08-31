import { NextResponse } from "next/server";
import * as calib from "@/lib/calibration";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Trạng thái hiệu chỉnh hiện tại. */
export async function GET() {
  const [calibration, done] = await Promise.all([
    calib.load(),
    db.assessment.count({ where: { isCalibration: true } }),
  ]);
  return NextResponse.json({
    calibration,
    done,
    needed: calib.MIN_CALIBRATION_SENTENCES,
  });
}

/** Tính lại ngưỡng từ toàn bộ bản ghi hiệu chỉnh. */
export async function POST() {
  const rows = await db.assessment.findMany({
    where: { isCalibration: true },
    select: { words: true, modelVersion: true },
  });

  if (rows.length < calib.MIN_CALIBRATION_SENTENCES) {
    return NextResponse.json(
      {
        error: `Cần ít nhất ${calib.MIN_CALIBRATION_SENTENCES} câu, hiện có ${rows.length}.`,
      },
      { status: 400 },
    );
  }

  const gops: number[] = [];
  for (const row of rows) {
    const words = JSON.parse(row.words) as { phones: { gop: number }[] }[];
    for (const w of words) for (const p of w.phones) gops.push(p.gop);
  }

  if (gops.length === 0) {
    return NextResponse.json({ error: "Không có điểm âm vị nào để tính." }, { status: 400 });
  }

  const calibration = calib.computeThresholds(gops, {
    sentenceCount: rows.length,
    modelVersion: rows[0]?.modelVersion ?? null,
  });
  await calib.save(calibration);
  return NextResponse.json({ calibration });
}

/** Xoá để hiệu chỉnh lại từ đầu. */
export async function DELETE() {
  const { count } = await db.assessment.deleteMany({ where: { isCalibration: true } });
  return NextResponse.json({ deleted: count });
}
