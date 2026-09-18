import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addMeasurements } from "@/lib/emg.functions";

type Side = "left" | "right" | "both";

export function AddMeasurementDialog({ onSaved }: { onSaved: () => void }) {
  const save = useServerFn(addMeasurements);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [side, setSide] = useState<Side>("both");
  const [rms, setRms] = useState("");
  const [peak, setPeak] = useState("");
  const [episodes, setEpisodes] = useState("");
  const [clench, setClench] = useState("");
  const [sleep, setSleep] = useState("");
  const [note, setNote] = useState("");
  const [csv, setCsv] = useState("");

  async function submitSingle(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          rows: [
            {
              measured_at: new Date(measuredAt).toISOString(),
              side,
              rms_uv: Number(rms),
              peak_uv: Number(peak),
              episodes: Number(episodes || 0),
              clench_seconds: Number(clench || 0),
              sleep_hours: sleep ? Number(sleep) : null,
              note: note || null,
            },
          ],
        },
      });
      toast.success("Измерение добавлено");
      setRms("");
      setPeak("");
      setEpisodes("");
      setClench("");
      setNote("");
      setOpen(false);
      onSaved();
    } catch (error) {
      toast.error("Не удалось сохранить: " + (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCsv(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const rows = csv
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.toLowerCase().startsWith("дата"))
        .map((line) => {
          const [date, sideValue, rmsValue, peakValue, episodesValue, clenchValue, sleepValue] =
            line.split(/[;,\t]/).map((part) => part.trim());
          const parsedSide: Side =
            sideValue === "left" || sideValue === "right" ? sideValue : "both";
          return {
            measured_at: new Date(date ?? "").toISOString(),
            side: parsedSide,
            rms_uv: Number(rmsValue),
            peak_uv: Number(peakValue),
            episodes: Number(episodesValue || 0),
            clench_seconds: Number(clenchValue || 0),
            sleep_hours: sleepValue ? Number(sleepValue) : null,
            note: null,
          };
        });

      if (rows.length === 0) {
        toast.error("Не нашли ни одной строки с данными");
        return;
      }

      const result = await save({ data: { rows } });
      toast.success(`Загружено записей: ${result.inserted}`);
      setCsv("");
      setOpen(false);
      onSaved();
    } catch (error) {
      toast.error("Проверьте формат строк: " + (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Добавить данные
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Новые измерения ЭМГ</DialogTitle>
          <DialogDescription>
            Введите ночную запись вручную или вставьте сразу несколько строк.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="single">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Одна запись</TabsTrigger>
            <TabsTrigger value="csv">Список строк</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-4">
            <form onSubmit={submitSingle} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="measured-at">Дата и время записи</Label>
                  <Input
                    id="measured-at"
                    type="datetime-local"
                    value={measuredAt}
                    onChange={(e) => setMeasuredAt(e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Сторона</Label>
                  <Select value={side} onValueChange={(value) => setSide(value as Side)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Обе стороны</SelectItem>
                      <SelectItem value="left">Левая</SelectItem>
                      <SelectItem value="right">Правая</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rms">Средняя активность, мкВ</Label>
                  <Input
                    id="rms"
                    type="number"
                    step="0.01"
                    value={rms}
                    onChange={(e) => setRms(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="peak">Максимум, мкВ</Label>
                  <Input
                    id="peak"
                    type="number"
                    step="0.01"
                    value={peak}
                    onChange={(e) => setPeak(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="episodes">Эпизодов сжатия</Label>
                  <Input
                    id="episodes"
                    type="number"
                    value={episodes}
                    onChange={(e) => setEpisodes(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clench">Время сжатия, сек</Label>
                  <Input
                    id="clench"
                    type="number"
                    value={clench}
                    onChange={(e) => setClench(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sleep">Часы сна</Label>
                  <Input
                    id="sleep"
                    type="number"
                    step="0.1"
                    value={sleep}
                    onChange={(e) => setSleep(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Заметка</Label>
                  <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Сохранить
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="csv" className="mt-4">
            <form onSubmit={submitCsv} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv">
                  Строки: дата; сторона; средняя мкВ; максимум мкВ; эпизоды; секунды; часы сна
                </Label>
                <Textarea
                  id="csv"
                  rows={8}
                  placeholder={"2026-09-15T02:00; both; 62.4; 180.2; 24; 240; 7.1"}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{" "}
                Загрузить список
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
