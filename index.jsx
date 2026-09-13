import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  PanResponder,
  StatusBar,
  Image,
} from "react-native";
// Требует: expo install expo-image-picker (официальный Expo-модуль,
// работает прямо в Expo Go, никаких веб-библиотек).
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { SafeAreaView } from "react-native-safe-area-context";

/*
  Дневник — Квестовая карта (Expo / React Native версия)
  ------------------------------------------------------
  Только React + react-native, без веб-библиотек (никакого lucide-react,
  никакого HTML/CSS). Иконки — обычные emoji-символы в <Text>, они
  работают одинаково на iOS/Android/Web(Expo) без установки чего-либо
  ещё через `expo install`.

  Упрощения относительно веб-версии (сознательно, чтобы не тянуть
  нативные зависимости):
  - фон "местности/дома/поля" — заливка цветом вместо CSS-градиента
  - тени — через shadow /elevation вместо boxShadow
  - дата и время дела вводятся текстом (ГГГГ-ММ-ДД и ЧЧ:ММ) вместо
    нативного календаря — при желании потом можно добавить
    @react-native-community/datetimepicker через `expo install`
  - шрифт — системный (никакой Comic Sans на телефоне обычно нет)
*/

const INK = "#3B2F2F";
const CARD = "#FFF7E8";
const PAPER = "#FFFDF7";
const GREEN = "#2ECC71";
const BLUE = "#2F6FDE";
const PALETTE = ["#E4572E", "#2A9D8F", "#E9C46A", "#8E44AD", "#3D5A80", "#E76F51", "#457B9D", "#B08968"];

const THEME_BG = {
  terrain: "#A3D584",
  home: "#EAD6F2",
  city: "#A9C5E3",
};

let uid = 100;
const nextId = () => uid++;
const todayStr = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function toDate(due) {
  if (!due) return null;
  if (due.date && due.time) return new Date(`${due.date}T${due.time}`);
  if (due.date) return new Date(`${due.date}T23:59:00`);
  if (due.time) {
    const [h, m] = due.time.split(":");
    const d = new Date();
    d.setHours(Number(h), Number(m), 0, 0);
    return d;
  }
  return null;
}

function formatRemaining(due) {
  if (!due) return "без срока";
  const d = toDate(due);
  if (!d) return "без срока";
  const diffMs = d.getTime() - Date.now();
  if (due.kind === "duration") {
    const diffDays = Math.ceil(diffMs / 86400000);
    if (diffDays <= 0) return "⏰ истекло";
    if (diffDays === 1) return "через 1 день";
    return `через ${diffDays} дн.`;
  }
  if (diffMs < 0) return "⏰ истекло";
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `через ${diffMin} мин`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `через ${diffH} ч`;
  const diffD = Math.round(diffH / 24);
  return `через ${diffD} дн.`;
}

function isTaskExpired(task) {
  if (!task || task.done || !task.due) return false;
  const d = toDate(task.due);
  if (!d) return false;
  return d.getTime() - Date.now() <= 0;
}

function shortLabel(text) {
  if (!text) return "";
  return text.length > 18 ? text.slice(0, 17) + "…" : text;
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const NOW = Date.now();

const PLACE_HINTS = [
  {
    layer: "🏠 Дом / Жильё",
    type: "home",
    items: [
      { emoji: "🏠", name: "Дом" },
      { emoji: "👵", name: "Дом бабушки" },
      { emoji: "🗺", name: "Дом друга" },
      { emoji: "👨‍👩‍👧", name: "Родители" },
      { emoji: "🏚", name: "Дача" },
    ],
  },
  {
    layer: "💪 Спорт / Тело",
    type: "sport",
    items: [
      { emoji: "🏋️", name: "Тренажёрный зал" },
      { emoji: "🏊", name: "Бассейн" },
      { emoji: "🧘", name: "Йога" },
      { emoji: "🧗", name: "Скалодром" },
      { emoji: "🏟", name: "Стадион" },
    ],
  },
  {
    layer: "📚 Учёба / Навыки",
    type: "study",
    items: [
      { emoji: "🎓", name: "Университет" },
      { emoji: "🎓", name: "Колледж" },
      { emoji: "📖", name: "Библиотека" },
      { emoji: "🎨", name: "Художественная школа" },
      { emoji: "🎵", name: "Музыкальная школа" },
      { emoji: "💻", name: "Курсы" },
      { emoji: "🗣", name: "Языковая школа" },
      { emoji: "🔬", name: "Лаборатория" },
      { emoji: "🔧", name: "Мастерская" },
    ],
  },
  {
    layer: "💼 Работа / Дело",
    type: "work",
    items: [
      { emoji: "🏢", name: "Офис" },
      { emoji: "🏭", name: "Завод" },
      { emoji: "🏬", name: "Магазин" },
      { emoji: "🧑‍🍳", name: "Кафе" },
      { emoji: "🍽", name: "Ресторан" },
      { emoji: "🏗", name: "Стройка" },
      { emoji: "🖥", name: "Коворкинг" },
    ],
  },
  {
    layer: "🎉 События / Культура",
    type: "event",
    items: [
      { emoji: "🎭", name: "Театр" },
      { emoji: "🎬", name: "Кинотеатр" },
      { emoji: "🖼", name: "Выставка" },
      { emoji: "🎲", name: "Настольный клуб" },
      { emoji: "🎮", name: "Киберспортивный турнир" },
      { emoji: "🎠", name: "Ярмарка" },
      { emoji: "🎓", name: "Форум" },
      { emoji: "🎪", name: "Фестиваль" },
      { emoji: "🎤", name: "Концерт" },
    ],
  },
  {
    layer: "🌍 Мир / Путешествия",
    type: "travel",
    items: [
      { emoji: "🗺", name: "Город" },
      { emoji: "🏘", name: "Деревня" },
      { emoji: "🌊", name: "Море" },
      { emoji: "🏔", name: "Горы" },
      { emoji: "🌲", name: "Лес" },
      { emoji: "💧", name: "Байкал" },
    ],
  },
  {
    layer: "❤️ Помощь / Смысл",
    type: "help",
    items: [
      { emoji: "🏥", name: "Больница" },
      { emoji: "🐕", name: "Приют для животных" },
      { emoji: "🍲", name: "Благотворительная кухня" },
      { emoji: "📦", name: "Волонтёрский центр" },
      { emoji: "🌱", name: "Экологический проект" },
      { emoji: "🩸", name: "Донорский пункт" },
      { emoji: "🏫", name: "Школа-интернат" },
      { emoji: "🧓", name: "Дом престарелых" },
    ],
  },
];

// Плоские, конкретные подсказки дел — привязаны к типу места (marker.type).
// Никакой абстракции ("завести традицию", "выспаться") — только то, что
// реально делают в этом месте.
const TASK_HINTS = {
  home: [
    "Поклеить обои", "Покрасить стены", "Поменять пол", "Починить мебель", "Собрать мебель",
    "Повесить полки", "Заменить смеситель", "Утеплить окна",
    "Убрать комнату", "Разобрать шкаф", "Выбросить хлам", "Помыть окна", "Пропылесосить",
    "Разобрать кладовку", "Помыть холодильник",
    "Приготовить ужин", "Испечь пирог", "Закрутить банки", "Приготовить на неделю",
    "Освоить новый рецепт", "Сделать заготовки",
    "Разобрать одежду", "Постирать", "Погладить", "Отдать ненужное", "Купить новое", "Сменить сезонное",
    "Полить цветы", "Покормить кота", "Починить кран", "Заменить лампочку",
    "Вызвать мастера", "Оплатить счета",
  ],
  sport: [
    "Начать ходить", "Составить программу", "Нанять тренера", "Сделать замеры",
    "Купить форму", "Записаться в зал",
    "Сбросить вес", "Набрать массу", "Пробежка",
	"Выступить на соревновании",
  ],
  study: [
    "Записаться на курс", "Купить учебник", "Составить расписание", "Сдать экзамен",
    "Защитить диплом", "Посещать лекции",
    "Выучить язык", "Освоить программу", "Научиться рисовать", "Научиться играть",
    "Сдать на права", "Пройти практику",
  ],
  work: [
    "Найти работу", "Сменить работу", "Пройти собеседование", "Взять проект",
    "Попросить повышение", "Составить резюме",
    "Открыть бизнес", "Найти клиентов", "Зарегистрировать ИП", "Сделать сайт",
    "Нанять сотрудника", "Выйти на доход",
  ],
  event: [
    "Купить билет", "Позвать друга", "Взять выходной", "Подготовить костюм",
    "Добраться", "Сделать фото",
    "Познакомиться", "Выступить", "Записаться в волонтёры", "Купить сувенир",
    "Попробовать еду",
  ],
  travel: [
    "Выбрать место", "Купить билет", "Забронировать жильё", "Собрать чемодан",
    "Оформить визу", "Сделать страховку", "Обменять деньги", "Составить маршрут",
    "Сходить на экскурсию", "Попробовать местную еду", "Сфотографировать",
    "Купить сувенир", "Познакомиться с местными",
  ],
  help: [
    "Сдать кровь", "Отвезти в больницу", "Помочь с ремонтом", "Отдать вещи",
    "Перевести деньги", "Купить продукты",
    "Навестить", "Позвонить", "Выслушать", "Помочь по дому", "Организовать сбор",
  ],
  general: [
    "Составить план", "Назначить дату", "Купить необходимое", "Найти информацию",
    "Записаться",
    "Позвонить", "Написать", "Встретиться", "Пригласить", "Попросить помощи",
    "Пройти курс", "Прочитать книгу", "Найти наставника", "Попробовать", "Отработать",
  ],
};

const initialScreens = {
  main: {
    id: "main",
    name: "КАРТА",
    theme: "terrain",
    parentId: null,
    markers: [
      { id: "dom", special: true, name: "Дом", emoji: "🏠", color: "#E4572E", x: 16, y: 60, linkTo: "home" },
      {
        id: "work",
        name: "Работа",
        emoji: "💼",
        color: "#2A9D8F",
        type: "work",
        x: 68,
        y: 20,
        tasks: [{ id: nextId(), title: "Отправить отчёт", due: null, done: false, notes: [], createdAt: NOW }],
      },
      {
        id: "parents",
        name: "Родители",
        emoji: "👴",
        color: "#E9C46A",
        type: "home",
        x: 30,
        y: 32,
        tasks: [{ id: nextId(), title: "Позвонить маме", due: null, done: false, notes: [], createdAt: NOW }],
      },
      {
        id: "anna",
        name: "Анна",
        emoji: "🎀",
        color: "#8E44AD",
        type: "general",
        x: 80,
        y: 55,
        tasks: [{ id: nextId(), title: "Подарок", due: null, done: false, notes: [], createdAt: NOW }],
      },
    ],
  },
  home: {
    id: "home",
    name: "🏠 ДОМ — ДЕЛА",
    theme: "home",
    parentId: "main",
    markers: [
      {
        id: "shopping",
        name: "Покупки",
        emoji: "🛒",
        color: "#2A9D8F",
        type: "home",
        x: 22,
        y: 22,
        tasks: [
          { id: nextId(), title: "Подготовить покупки на новоселье", due: null, done: false, notes: [], createdAt: NOW },
          { id: nextId(), title: "Купить газонокосилку", due: null, done: false, notes: [], createdAt: NOW },
        ],
      },
      {
        id: "library",
        name: "Библиотека / учёба",
        emoji: "📚",
        color: "#3D5A80",
        type: "study",
        x: 72,
        y: 24,
        tasks: [{ id: nextId(), title: "Взять книгу «Ассемблер» (1975) — библиотека", due: null, done: false, notes: [], createdAt: NOW }],
      },
      {
        id: "chores",
        name: "Хозяйство",
        emoji: "🔧",
        color: "#E76F51",
        type: "home",
        x: 28,
        y: 66,
        tasks: [
          { id: nextId(), title: "Полить цветы", due: { date: todayStr(0), time: "19:00", kind: "date" }, done: false, notes: [], createdAt: NOW },
          { id: nextId(), title: "Починить шкаф", due: { date: todayStr(5), time: null, kind: "date" }, done: false, notes: [], createdAt: NOW },
        ],
      },
      { id: "misc", name: "Разное", emoji: "✨", color: "#B08968", type: "general", x: 76, y: 64, tasks: [] },
    ],
  },
};

/* -------- small shared UI bits -------- */

function Chip({ label, active, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          borderWidth: 2,
          borderColor: INK,
          borderRadius: 14,
          paddingVertical: 4,
          paddingHorizontal: 10,
          backgroundColor: active ? INK : CARD,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 11.5, color: active ? "#fff" : INK, fontWeight: "bold" }}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress, color = INK, textColor = "#fff", style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: color,
          borderWidth: 2,
          borderColor: INK,
          borderRadius: 8,
          paddingVertical: 9,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: textColor, fontWeight: "bold", fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

function Overlay({ children, zIndex = 50, background = PAPER }) {
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: background, zIndex, elevation: zIndex }}>
      {children}
    </View>
  );
}

function OverlayHeader({ onBack, backLabel = "Назад", title, onClose }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 2,
        borderColor: INK,
        borderStyle: "dashed",
      }}
    >
      <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 60 }}>
        <Text style={{ fontSize: 16 }}>←</Text>
        <Text style={{ fontWeight: "bold", color: INK }}>{backLabel}</Text>
      </Pressable>
      <Text style={{ fontSize: 15, fontWeight: "bold", color: INK, textAlign: "center", flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      <Pressable onPress={onClose || onBack} style={{ minWidth: 60, alignItems: "flex-end" }}>
        <Text style={{ fontSize: 18 }}>✕</Text>
      </Pressable>
    </View>
  );
}

/* -------- Pin (draggable marker on the map) -------- */

function Pin({ marker, editMode, editAction, containerSize, onOpen, onDragMove, onDelete }) {
  const size = marker.special ? 58 : 46;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => editMode && editAction === "move",
    onMoveShouldSetPanResponder: () => editMode && editAction === "move",
    onPanResponderMove: (evt, gesture) => {
      if (!containerSize.width || !containerSize.height) return;
      const dxPct = (gesture.dx / containerSize.width) * 100;
      const dyPct = (gesture.dy / containerSize.height) * 100;
      let nx = marker.x + dxPct;
      let ny = marker.y + dyPct;
      nx = Math.min(95, Math.max(5, nx));
      ny = Math.min(93, Math.max(7, ny));
      onDragMove(marker.id, nx, ny);
    },
  });

  const doneCount = marker.tasks ? marker.tasks.filter((t) => t.done).length : 0;
  const total = marker.tasks ? marker.tasks.length : 0;
  const previewTasks = marker.tasks ? marker.tasks.filter((t) => !t.done).slice(0, 2) : [];

  const handlePress = () => {
    if (editMode) {
      if (editAction === "delete") onDelete(marker);
      return;
    }
    onOpen(marker);
  };

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        position: "absolute",
        left: `${marker.x}%`,
        top: `${marker.y}%`,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        alignItems: "center",
        zIndex: 2,
      }}
    >
      <Pressable onPress={handlePress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.88 : 1 }] }]}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: marker.color,
            borderWidth: 3,
            borderColor: INK,
            borderStyle: editMode ? "dashed" : "solid",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            shadowColor: INK,
            shadowOffset: { width: 2, height: 3 },
            shadowOpacity: 0.35,
            shadowRadius: 0,
            elevation: 4,
          }}
        >
          {marker.image ? (
            <Image source={{ uri: marker.image }} style={{ width: size, height: size }} />
          ) : (
            <Text style={{ fontSize: marker.special ? 24 : 19 }}>{marker.emoji}</Text>
          )}
          {marker.image && (
            <View
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: "#fff",
                borderWidth: 1.5,
                borderColor: INK,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 10 }}>{marker.emoji}</Text>
            </View>
          )}
          {editMode && (
            <View
              style={{
                position: "absolute",
                bottom: -5,
                right: -5,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: editAction === "delete" ? "#E4572E" : "#fff",
                borderWidth: 2,
                borderColor: INK,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 9 }}>{editAction === "delete" ? "🗑" : "✥"}</Text>
            </View>
          )}
        </View>
      </Pressable>

      <View
        style={{
          marginTop: 4,
          backgroundColor: "#fff",
          borderWidth: 2,
          borderColor: INK,
          borderRadius: 8,
          paddingHorizontal: 7,
          paddingVertical: 2,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: "bold", color: INK }}>
          {marker.name}
          {total > 0 ? <Text style={{ fontWeight: "normal", opacity: 0.6 }}> {doneCount}/{total}</Text> : null}
        </Text>
      </View>

      {!editMode && previewTasks.length > 0 && (
        <View style={{ marginTop: 3, alignItems: "center" }}>
          {previewTasks.map((t) => (
            <View
              key={t.id}
              style={{
                marginTop: 2,
                backgroundColor: "#fff",
                borderWidth: 1.5,
                borderColor: INK,
                paddingHorizontal: 6,
                paddingVertical: 2,
                maxWidth: 110,
              }}
            >
              <Text style={{ fontSize: 9.5, fontFamily: "monospace", color: isTaskExpired(t) ? BLUE : "#5b4c3f" }} numberOfLines={1}>
                {shortLabel(t.title)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* -------- Hints modal (places / task suggestions) -------- */

function HintsModal({ title, groups, items, onClose, onPick }) {
  return (
    <Overlay zIndex={70} background="rgba(59,47,47,0.55)">
      <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: PAPER,
            borderWidth: 3,
            borderColor: INK,
            borderRadius: 18,
            width: "100%",
            maxWidth: 340,
            maxHeight: "82%",
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 2, borderColor: INK, borderStyle: "dashed" }}>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: INK, flex: 1, paddingRight: 8 }}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={{ padding: 14 }}>
            {groups &&
              groups.map((g) => (
                <View key={g.layer} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, color: "#8a7a6a", marginBottom: 6 }}>{g.layer}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {g.items.map((it) => {
                      const label = typeof it === "string" ? it : `${it.emoji} ${it.name}`;
                      return <Chip key={label} label={label} onPress={() => onPick({ ...(typeof it === "string" ? { name: it } : it), type: g.type })} />;
                    })}
                  </View>
                </View>
              ))}

            {items && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {items.map((it) => (
                  <Chip key={it} label={it} onPress={() => onPick(it)} />
                ))}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Overlay>
  );
}

/* -------- Confirm dialog -------- */

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <Overlay zIndex={65} background="rgba(59,47,47,0.5)">
      <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }} onPress={onCancel}>
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: PAPER, borderWidth: 3, borderColor: INK, borderRadius: 16, width: "100%", maxWidth: 260, padding: 18 }}
        >
          <Text style={{ fontSize: 14, color: INK, marginBottom: 14, textAlign: "center" }}>{message}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <PrimaryButton label="Отмена" color="#fff" textColor={INK} onPress={onCancel} style={{ flex: 1 }} />
            <PrimaryButton label="Удалить" color="#E4572E" onPress={onConfirm} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Overlay>
  );
}

/* -------- Due editor: без срока / дата (текстом) / срок (дни) -------- */

function DueEditor({ dueMode, setDueMode, dueDate, setDueDate, dueTime, setDueTime, dueDays, setDueDays }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
        {[
          { key: "none", label: "Без срока" },
          { key: "date", label: "📅 Дата" },
          { key: "duration", label: "⏳ Срок" },
        ].map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setDueMode(opt.key)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: INK,
              backgroundColor: dueMode === opt.key ? INK : "#fff",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "bold", color: dueMode === opt.key ? "#fff" : INK }}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      {dueMode === "date" && (
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
          <TextInput
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="ГГГГ-ММ-ДД"
            placeholderTextColor="#a0907e"
            style={{ flex: 1, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12.5 }}
          />
          <TextInput
            value={dueTime}
            onChangeText={setDueTime}
            placeholder="ЧЧ:ММ"
            placeholderTextColor="#a0907e"
            style={{ width: 80, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12.5 }}
          />
        </View>
      )}

      {dueMode === "duration" && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Pressable onPress={() => setDueDays((d) => Math.max(1, d - 1))} style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontWeight: "bold" }}>−</Text>
          </Pressable>
          <Text style={{ minWidth: 26, textAlign: "center", fontWeight: "bold", color: INK }}>{dueDays}</Text>
          <Pressable onPress={() => setDueDays((d) => d + 1)} style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontWeight: "bold" }}>+</Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: "#8a7a6a" }}>дней с отсчётом</Text>
        </View>
      )}
    </View>
  );
}

/* -------- Notes overlay for a single task -------- */

function TaskDetailOverlay({ task, markerColor, onBack, onAddNote, onRemoveNote }) {
  const [note, setNote] = useState("");
  const expired = isTaskExpired(task);
  const submit = () => {
    if (!note.trim()) return;
    onAddNote(note.trim());
    setNote("");
  };
  return (
    <Overlay zIndex={52}>
      <OverlayHeader onBack={onBack} title="" onClose={onBack} />
      <ScrollView style={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", color: expired ? BLUE : INK, marginBottom: 14 }}>{task.title}</Text>

        <View style={{ marginBottom: 16, gap: 6 }}>
          {(!task.notes || task.notes.length === 0) && <Text style={{ color: "#a0907e", fontSize: 12.5, fontStyle: "italic" }}>Пометок пока нет.</Text>}
          {task.notes &&
            task.notes.map((n, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: CARD, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ flex: 1, fontSize: 13, color: INK }}>{n}</Text>
                <Pressable onPress={() => onRemoveNote(i)}>
                  <Text style={{ opacity: 0.5 }}>✕</Text>
                </Pressable>
              </View>
            ))}
        </View>

        <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Новая пометка..."
            placeholderTextColor="#a0907e"
            style={{ flex: 1, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 }}
          />
          <Pressable onPress={submit} style={{ backgroundColor: markerColor, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16 }}>＋</Text>
          </Pressable>
        </View>

        <View style={{ borderWidth: 3, borderColor: INK, borderStyle: "dashed", borderRadius: 12, padding: 14, alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: expired ? BLUE : INK }}>{formatRemaining(task.due)}</Text>
        </View>
      </ScrollView>
    </Overlay>
  );
}

/* -------- Task list ("Дела") for one marker -------- */

function TaskScreen({ marker, onClose, onToggle, onAdd, onDelete, onAddNote, onRemoveNote }) {
  const [title, setTitle] = useState("");
  const [dueMode, setDueMode] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [dueDays, setDueDays] = useState(1);
  const [noteTaskId, setNoteTaskId] = useState(null);
  const [showHints, setShowHints] = useState(false);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState(null);
  if (!marker) return null;

  const noteTask = marker.tasks && marker.tasks.find((t) => t.id === noteTaskId);
  const pendingTask = marker.tasks && marker.tasks.find((t) => t.id === pendingDeleteTaskId);

  const submit = () => {
    if (!title.trim()) return;
    let due = null;
    if (dueMode === "date") {
      if (dueDate || dueTime) due = { date: dueDate || null, time: dueTime || null, kind: "date" };
    } else if (dueMode === "duration") {
      due = { date: todayStr(dueDays), time: null, kind: "duration" };
    }
    onAdd(marker.id, title.trim(), due);
    setTitle("");
    setDueMode("none");
    setDueDate("");
    setDueTime("");
    setDueDays(1);
  };

  return (
    <Overlay zIndex={50}>
      <OverlayHeader onBack={onClose} title={`${marker.emoji} ${marker.name.toUpperCase()}`} onClose={onClose} />
      {marker.image && (
        <View style={{ alignItems: "center", paddingTop: 10 }}>
          <Image source={{ uri: marker.image }} style={{ width: 90, height: 90, borderRadius: 12, borderWidth: 2, borderColor: INK }} />
        </View>
      )}
      <Text style={{ paddingHorizontal: 16, paddingTop: 10, fontSize: 12, letterSpacing: 1, color: "#8a7a6a" }}>ДЕЛА</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
        {(!marker.tasks || marker.tasks.length === 0) && (
          <Text style={{ color: "#a0907e", fontSize: 13, fontStyle: "italic" }}>Пока пусто — самое время добавить первое дело.</Text>
        )}
        {marker.tasks &&
          marker.tasks.map((t) => {
            const expired = isTaskExpired(t);
            return (
              <View
                key={t.id}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  backgroundColor: t.done ? "#F1EEE4" : CARD,
                  borderWidth: 2,
                  borderColor: INK,
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <Pressable
                  onPress={() => onToggle(marker.id, t.id)}
                  style={{
                    width: 19,
                    height: 19,
                    borderRadius: 5,
                    borderWidth: 2,
                    borderColor: INK,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 2,
                    backgroundColor: t.done ? marker.color : "transparent",
                  }}
                >
                  {t.done && <Text style={{ color: "#fff", fontSize: 11 }}>✓</Text>}
                </Pressable>

                <Pressable style={{ flex: 1 }} onPress={() => setNoteTaskId(t.id)}>
                  <Text
                    style={{
                      fontSize: 14,
                      color: expired ? BLUE : INK,
                      textDecorationLine: t.done ? "line-through" : "none",
                      opacity: t.done ? 0.55 : 1,
                      fontWeight: expired ? "bold" : "normal",
                    }}
                  >
                    {t.title}
                  </Text>
                  {t.notes && t.notes.length > 0 && (
                    <View style={{ marginTop: 3, gap: 1 }}>
                      {t.notes.map((n, i) => (
                        <Text key={i} style={{ fontSize: 11.5, color: "#6b5b4d" }}>
                          [{n}]
                        </Text>
                      ))}
                    </View>
                  )}
                  <Text style={{ fontSize: 11, marginTop: 3, color: expired ? BLUE : "#9a8a76", fontWeight: expired || t.due ? "bold" : "normal" }}>
                    {formatRemaining(t.due)}
                  </Text>
                </Pressable>

                <Pressable onPress={() => setPendingDeleteTaskId(t.id)} style={{ marginTop: 2 }}>
                  <Text style={{ opacity: 0.5 }}>✕</Text>
                </Pressable>
              </View>
            );
          })}
      </ScrollView>

      <View style={{ borderTopWidth: 2, borderColor: INK, borderStyle: "dashed", padding: 12 }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Новое дело..."
          placeholderTextColor="#a0907e"
          style={{ borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, marginBottom: 8 }}
        />

        <Pressable
          onPress={() => setShowHints(true)}
          style={{ alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: INK, borderStyle: "dashed", borderRadius: 8, paddingVertical: 6, marginBottom: 8, backgroundColor: CARD }}
        >
          <Text style={{ fontSize: 12, color: INK }}>💡 Подсказки — что можно сделать?</Text>
        </Pressable>

        <DueEditor dueMode={dueMode} setDueMode={setDueMode} dueDate={dueDate} setDueDate={setDueDate} dueTime={dueTime} setDueTime={setDueTime} dueDays={dueDays} setDueDays={setDueDays} />

        <PrimaryButton label="Добавить дело" color="#BDEFC9" textColor={INK} onPress={submit} />
      </View>

      {showHints && (
        <HintsModal
          title={`💡 Что можно сделать: ${marker.name}`}
          items={TASK_HINTS[marker.type] || TASK_HINTS.general}
          onClose={() => setShowHints(false)}
          onPick={(it) => {
            setTitle(it);
            setShowHints(false);
          }}
        />
      )}

      {noteTask && (
        <TaskDetailOverlay
          task={noteTask}
          markerColor={marker.color}
          onBack={() => setNoteTaskId(null)}
          onAddNote={(text) => onAddNote(marker.id, noteTaskId, text)}
          onRemoveNote={(idx) => onRemoveNote(marker.id, noteTaskId, idx)}
        />
      )}

      {pendingTask && (
        <ConfirmDialog
          message={`Удалить дело «${pendingTask.title}»?`}
          onCancel={() => setPendingDeleteTaskId(null)}
          onConfirm={() => {
            onDelete(marker.id, pendingDeleteTaskId);
            setPendingDeleteTaskId(null);
          }}
        />
      )}
    </Overlay>
  );
}

/* -------- New marker / new field form -------- */

function NewPinForm({ title, onClose, onCreate, confirmLabel, showColor = true, showPlaceHints = true, imageAspect = [1, 1] }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📍");
  const [color, setColor] = useState(PALETTE[0]);
  const [type, setType] = useState("general");
  const [image, setImage] = useState(null);
  const [showHints, setShowHints] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: imageAspect,
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      const src = result.assets[0].uri;
      const ext = src.split(".").pop() || "jpg";
      const dst = `${FileSystem.documentDirectory}pin_${Date.now()}.${ext}`;
      try {
        await FileSystem.copyAsync({ from: src, to: dst });
        setImage(dst);
      } catch (e) {
        setImage(src); // если копирование не удалось — оставим временный
      }
    }
  };

  return (
    <Overlay zIndex={60} background="rgba(59,47,47,0.45)">
      <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: PAPER, borderWidth: 3, borderColor: INK, borderRadius: 18, width: "100%", maxWidth: 280, padding: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: "bold", color: INK }}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          {showColor && showPlaceHints && (
            <Text style={{ fontSize: 11.5, color: "#8a7a6a", fontStyle: "italic", marginBottom: 8, lineHeight: 16 }}>
              Введите места, которые вы знаете — например: дом Светы, огород соседа, дома родственников и знакомых, или места, в которых вы ещё даже не были, но которые потенциально представляют интерес.
            </Text>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Pressable
              onPress={pickImage}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                borderWidth: 2,
                borderColor: INK,
                borderStyle: image ? "solid" : "dashed",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                backgroundColor: "#fff",
              }}
            >
              {image ? <Image source={{ uri: image }} style={{ width: 52, height: 52 }} /> : <Text style={{ fontSize: 18 }}>📷</Text>}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, color: INK, fontWeight: "bold" }}>{image ? "Фото выбрано" : "Своё фото (необязательно)"}</Text>
              <Text style={{ fontSize: 10.5, color: "#8a7a6a" }}>Из галереи телефона</Text>
            </View>
            {image && (
              <Pressable onPress={() => setImage(null)}>
                <Text style={{ opacity: 0.5 }}>✕</Text>
              </Pressable>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
            <TextInput
              value={emoji}
              onChangeText={(v) => setEmoji(v.slice(0, 2))}
              style={{ width: 44, textAlign: "center", fontSize: 18, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingVertical: 6 }}
            />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Название"
              placeholderTextColor="#a0907e"
              style={{ flex: 1, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13.5 }}
            />
          </View>

          {showColor && showPlaceHints && (
            <Pressable
              onPress={() => setShowHints(true)}
              style={{ alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: INK, borderStyle: "dashed", borderRadius: 8, paddingVertical: 6, marginBottom: 12, backgroundColor: CARD }}
            >
              <Text style={{ fontSize: 12, color: INK }}>💡 Подсказки — какие места бывают?</Text>
            </Pressable>
          )}

          {!showColor && (
            <Text style={{ textAlign: "center", fontSize: 11.5, color: "#8a7a6a", fontStyle: "italic", marginBottom: 12, lineHeight: 16 }}>
              💡 Поле — это тоже локация (например, Байкал). Заводите его, если на карте не хватает места, эта локация далека от остальных, или в ней много своих категорий — как в «Доме».
            </Text>
          )}

          {showColor && (
            <>
              <Text style={{ fontSize: 11.5, color: "#8a7a6a", marginBottom: 6 }}>Цвет метки</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {PALETTE.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: c,
                      borderWidth: color === c ? 3 : 2,
                      borderColor: color === c ? INK : "transparent",
                    }}
                  />
                ))}
              </View>
            </>
          )}

          <PrimaryButton
            label={confirmLabel}
            color={color}
            onPress={() => name.trim() && onCreate({ name: name.trim(), emoji: emoji.trim() || "📍", color, type, image })}
          />
        </Pressable>
      </Pressable>

      {showHints && showPlaceHints && (
        <HintsModal
          title="💡 Места, куда можно попасть"
          groups={PLACE_HINTS}
          onClose={() => setShowHints(false)}
          onPick={(it) => {
            setName(it.name);
            setEmoji(it.emoji);
            setType(it.type || "general");
            setShowHints(false);
          }}
        />
      )}
    </Overlay>
  );
}

/* -------- Журнал: список активных дел + карточка одного дела -------- */

function JournalList({ entries, onClose, onOpenDetail }) {
  return (
    <Overlay zIndex={55}>
      <OverlayHeader onBack={onClose} title="📖 ЖУРНАЛ" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {entries.length === 0 && <Text style={{ color: "#a0907e", fontSize: 13, fontStyle: "italic" }}>Активных дел пока нет.</Text>}
        {entries.map((e) => (
          <Pressable
            key={e.task.id}
            onPress={() => onOpenDetail(e)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CARD, borderWidth: 2, borderColor: INK, borderRadius: 10, padding: 10 }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: e.markerColor, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14 }}>{e.markerEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, color: INK, fontWeight: "bold" }}>{e.task.title}</Text>
              <Text style={{ fontSize: 10.5, color: "#9a8a76" }}>
                {e.screenName.replace(/^[^\wА-Яа-я]+/, "")} · {e.markerName}
              </Text>
            </View>
            <Text style={{ fontSize: 10.5, color: "#6b5b4d", fontFamily: "monospace" }}>{formatRemaining(e.task.due)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Overlay>
  );
}

function JournalDetail({ entry, onBack, onClose, onAddNote, onRemoveNote }) {
  const [note, setNote] = useState("");
  if (!entry) return null;
  const submit = () => {
    if (!note.trim()) return;
    onAddNote(note.trim());
    setNote("");
  };
  return (
    <Overlay zIndex={58}>
      <OverlayHeader onBack={onBack} backLabel="Журнал" title="" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 19, fontWeight: "bold", color: INK, marginBottom: 4 }}>
          {entry.markerEmoji} {entry.task.title}
        </Text>
        <Text style={{ fontSize: 11.5, color: "#9a8a76", marginBottom: 14 }}>
          {entry.markerName} · {entry.screenName.replace(/^[^\wА-Яа-я]+/, "")}
        </Text>

        <View style={{ gap: 6, marginBottom: 16 }}>
          {entry.task.notes.length === 0 && <Text style={{ color: "#a0907e", fontSize: 12.5, fontStyle: "italic" }}>Пометок пока нет.</Text>}
          {entry.task.notes.map((n, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: CARD, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ flex: 1, fontSize: 13, color: INK }}>{n}</Text>
              <Pressable onPress={() => onRemoveNote(i)}>
                <Text style={{ opacity: 0.5 }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Новая пометка..."
            placeholderTextColor="#a0907e"
            style={{ flex: 1, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 }}
          />
          <Pressable onPress={submit} style={{ backgroundColor: entry.markerColor, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16 }}>＋</Text>
          </Pressable>
        </View>

        <View style={{ borderWidth: 3, borderColor: INK, borderStyle: "dashed", borderRadius: 12, padding: 14, alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: isTaskExpired(entry.task) ? BLUE : INK }}>{formatRemaining(entry.task.due)}</Text>
        </View>
      </ScrollView>
    </Overlay>
  );
}

/* -------- История -------- */

function HistoryList({ entries, onClose, onDeleteEntry }) {
  const [pending, setPending] = useState(null);
  return (
    <Overlay zIndex={55}>
      <OverlayHeader onBack={onClose} title="🕓 ИСТОРИЯ" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {entries.length === 0 && <Text style={{ color: "#a0907e", fontSize: 13, fontStyle: "italic" }}>Пока нет ни одного дела.</Text>}
        {entries.map((e) => {
          const status = e.removedAt ? (e.task.done ? "Выполнено" : "Удалено") : e.task.done ? "Выполнено" : isTaskExpired(e.task) ? "Провалено" : "Активно";
          const statusColor = e.task.done ? "#2A9D8F" : e.removedAt ? "#C0392B" : isTaskExpired(e.task) ? BLUE : "#8a7a6a";
          const canDelete = status === "Выполнено" || status === "Удалено";
          return (
            <View key={`${e.task.id}-${e.removedAt || "live"}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CARD, borderWidth: 2, borderColor: INK, borderRadius: 10, padding: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: e.markerColor, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 13 }}>{e.markerEmoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: INK, fontWeight: "bold" }}>{e.task.title}</Text>
                <Text style={{ fontSize: 10, color: "#9a8a76" }}>
                  {e.markerName} · создано {fmtDate(e.task.createdAt)}
                </Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: "bold", color: statusColor }}>{status}</Text>
              {canDelete && (
                <Pressable onPress={() => setPending(e)}>
                  <Text style={{ opacity: 0.5, fontSize: 13 }}>🗑</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      {pending && (
        <ConfirmDialog
          message={`Удалить «${pending.task.title}» из истории?`}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            onDeleteEntry(pending);
            setPending(null);
          }}
        />
      )}
    </Overlay>
  );
}

/* -------- Main app -------- */

export default function App() {
  const [screens, setScreens] = useState(initialScreens);
  const [currentId, setCurrentId] = useState("main");
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editAction, setEditAction] = useState("move");
  const [showAddMarker, setShowAddMarker] = useState(false);
  const [showAddScreen, setShowAddScreen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingDeleteField, setPendingDeleteField] = useState(null);
  const [topLevelOrder, setTopLevelOrder] = useState(["main"]);
  const [showJournal, setShowJournal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [journalDetail, setJournalDetail] = useState(null);
  const [historyLog, setHistoryLog] = useState([]);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);

  // Загрузка данных при старте
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("questmap_v1");
        if (raw) {
          const data = JSON.parse(raw);
          if (data.screens) setScreens(data.screens);
          if (data.topLevelOrder) setTopLevelOrder(data.topLevelOrder);
          if (data.historyLog) setHistoryLog(data.historyLog);
        }
      } catch (e) {
        // данных нет или битые — стартуем с initialScreens
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Автосохранение при любом изменении
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem("questmap_v1", JSON.stringify({ screens, topLevelOrder, historyLog })).catch(() => {});
  }, [screens, topLevelOrder, historyLog, loaded]);

  const screen = screens[currentId];
  const activeMarker = (screen.markers || []).find((m) => m.id === activeTaskId) || null;

  const updateScreen = (id, fn) => setScreens((prev) => ({ ...prev, [id]: fn(prev[id]) }));

  const archiveTasks = (scr, mk) => {
    const entries = (mk.tasks || []).map((task) => ({
      screenId: scr.id,
      screenName: scr.name,
      markerId: mk.id,
      markerName: mk.name,
      markerEmoji: mk.emoji,
      markerColor: mk.color,
      task,
      removedAt: Date.now(),
    }));
    if (entries.length) setHistoryLog((prev) => [...prev, ...entries]);
  };
  const archiveScreen = (scr) => (scr.markers || []).forEach((mk) => archiveTasks(scr, mk));

  const handleOpen = (marker) => {
    if (marker.linkTo) {
      setCurrentId(marker.linkTo);
      setEditMode(false);
      return;
    }
    setActiveTaskId(marker.id);
  };

  const handleDragMove = (markerId, x, y) => {
    updateScreen(currentId, (s) => ({ ...s, markers: s.markers.map((m) => (m.id === markerId ? { ...m, x, y } : m)) }));
  };

  const toggleTask = (markerId, taskId) => {
    updateScreen(currentId, (s) => ({
      ...s,
      markers: s.markers.map((m) => (m.id === markerId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) } : m)),
    }));
  };
  const addTask = (markerId, title, due) => {
    updateScreen(currentId, (s) => ({
      ...s,
      markers: s.markers.map((m) => (m.id === markerId ? { ...m, tasks: [...(m.tasks || []), { id: nextId(), title, due, done: false, notes: [], createdAt: Date.now() }] } : m)),
    }));
  };
  const deleteTask = (markerId, taskId) => {
    const marker = screen.markers.find((m) => m.id === markerId);
    const task = marker && marker.tasks.find((t) => t.id === taskId);
    if (marker && task) {
      setHistoryLog((prev) => [
        ...prev,
        { screenId: currentId, screenName: screen.name, markerId: marker.id, markerName: marker.name, markerEmoji: marker.emoji, markerColor: marker.color, task, removedAt: Date.now() },
      ]);
    }
    updateScreen(currentId, (s) => ({ ...s, markers: s.markers.map((m) => (m.id === markerId ? { ...m, tasks: m.tasks.filter((t) => t.id !== taskId) } : m)) }));
  };
  const addNoteLocal = (markerId, taskId, text) => {
    updateScreen(currentId, (s) => ({
      ...s,
      markers: s.markers.map((m) => (m.id === markerId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, notes: [...(t.notes || []), text] } : t)) } : m)),
    }));
  };
  const removeNoteLocal = (markerId, taskId, idx) => {
    updateScreen(currentId, (s) => ({
      ...s,
      markers: s.markers.map((m) => (m.id === markerId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, notes: t.notes.filter((_, i) => i !== idx) } : t)) } : m)),
    }));
  };

  const createMarker = ({ name, emoji, color, type, image }) => {
    updateScreen(currentId, (s) => ({ ...s, markers: [...s.markers, { id: `m${nextId()}`, name, emoji, color, type: type || "general", image: image || null, x: 50, y: 50, tasks: [] }] }));
    setShowAddMarker(false);
  };

  const createScreen = ({ name, emoji, image }) => {
    const newId = `s${nextId()}`;
    setScreens((prev) => ({ ...prev, [newId]: { id: newId, name: `${emoji} ${name.toUpperCase()}`, theme: "city", image: image || null, parentId: null, markers: [] } }));
    setTopLevelOrder((prev) => [...prev, newId]);
    setShowAddScreen(false);
    setEditMode(false);
    setCurrentId(newId);
  };

  const deleteField = (id) => {
    const scr = screens[id];
    if (scr) archiveScreen(scr);
    setScreens((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTopLevelOrder((prev) => prev.filter((x) => x !== id));
    if (currentId === id) setCurrentId("main");
  };

  const deleteMarker = (markerId) => {
    const marker = screen.markers.find((m) => m.id === markerId);
    if (marker) archiveTasks(screen, marker);
    if (marker && marker.linkTo && screens[marker.linkTo]) archiveScreen(screens[marker.linkTo]);
    setScreens((prev) => {
      const next = { ...prev, [currentId]: { ...prev[currentId], markers: prev[currentId].markers.filter((m) => m.id !== markerId) } };
      if (marker && marker.linkTo && next[marker.linkTo]) delete next[marker.linkTo];
      return next;
    });
  };

  const siblings = topLevelOrder.includes(currentId) ? { list: topLevelOrder, index: topLevelOrder.indexOf(currentId) } : { list: [], index: -1 };
  const goSibling = (dir) => {
    const target = siblings.list[siblings.index + dir];
    if (target) setCurrentId(target);
  };

  const allEntries = () => {
    const out = [];
    Object.values(screens).forEach((scr) => {
      (scr.markers || []).forEach((mk) => {
        (mk.tasks || []).forEach((task) => {
          out.push({ screenId: scr.id, screenName: scr.name, markerId: mk.id, markerName: mk.name, markerEmoji: mk.emoji, markerColor: mk.color, task });
        });
      });
    });
    return out;
  };
  const activeEntries = allEntries().filter((e) => !e.task.done && !isTaskExpired(e.task));
  const historyEntries = [...allEntries(), ...historyLog].sort((a, b) => (b.task.createdAt || 0) - (a.task.createdAt || 0));

  const hardDeleteEntry = (entry) => {
    if (entry.removedAt) {
      setHistoryLog((prev) => prev.filter((e) => !(e.task.id === entry.task.id && e.removedAt === entry.removedAt)));
    } else {
      setScreens((prev) => {
        const scr = prev[entry.screenId];
        if (!scr) return prev;
        return { ...prev, [entry.screenId]: { ...scr, markers: scr.markers.map((m) => (m.id === entry.markerId ? { ...m, tasks: m.tasks.filter((t) => t.id !== entry.task.id) } : m)) } };
      });
    }
  };

  const findEntry = (loc) => {
    if (!loc) return null;
    const scr = screens[loc.screenId];
    if (!scr) return null;
    const mk = scr.markers.find((m) => m.id === loc.markerId);
    if (!mk) return null;
    const task = (mk.tasks || []).find((t) => t.id === loc.taskId);
    if (!task) return null;
    return { screenId: scr.id, screenName: scr.name, markerId: mk.id, markerName: mk.name, markerEmoji: mk.emoji, markerColor: mk.color, task };
  };
  const journalDetailEntry = findEntry(journalDetail);

  const addNoteGlobal = (text) => {
    if (!journalDetail) return;
    const { screenId, markerId, taskId } = journalDetail;
    setScreens((prev) => ({
      ...prev,
      [screenId]: { ...prev[screenId], markers: prev[screenId].markers.map((m) => (m.id === markerId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, notes: [...(t.notes || []), text] } : t)) } : m)) },
    }));
  };
  const removeNoteGlobal = (idx) => {
    if (!journalDetail) return;
    const { screenId, markerId, taskId } = journalDetail;
    setScreens((prev) => ({
      ...prev,
      [screenId]: { ...prev[screenId], markers: prev[screenId].markers.map((m) => (m.id === markerId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, notes: t.notes.filter((_, i) => i !== idx) } : t)) } : m)) },
    }));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: PAPER }} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 3, borderColor: INK, borderStyle: "dashed" }}>
        {screen.parentId ? (
          <Pressable
            onPress={() => {
              setCurrentId(screen.parentId);
              setEditMode(false);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 46 }}
          >
            <Text>← Карта</Text>
          </Pressable>
        ) : (
          <View style={{ width: 46 }} />
        )}
        <Text style={{ fontSize: 16, fontWeight: "bold", color: INK, textAlign: "center", flex: 1 }} numberOfLines={1}>
          {screen.name}
        </Text>
        {topLevelOrder.includes(currentId) && currentId !== "main" ? (
          <Pressable onPress={() => setPendingDeleteField(screen)} style={{ minWidth: 46, alignItems: "flex-end" }}>
            <Text style={{ fontSize: 16 }}>🗑</Text>
          </Pressable>
        ) : (
          <View style={{ width: 46 }} />
        )}
      </View>

      <View
        style={{ flex: 1, backgroundColor: THEME_BG[screen.theme || "terrain"] }}
        onLayout={(e) => setMapSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {screen.image && (
          <Image
            source={{ uri: screen.image }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            resizeMode="cover"
          />
        )}
        {screen.markers.map((m) => (
          <Pin
            key={m.id}
            marker={m}
            editMode={editMode}
            editAction={editAction}
            containerSize={mapSize}
            onOpen={handleOpen}
            onDragMove={handleDragMove}
            onDelete={(mk) => setPendingDelete(mk)}
          />
        ))}

        {!editMode && siblings.index > 0 && (
          <Pressable
            onPress={() => goSibling(-1)}
            style={{ position: "absolute", left: 10, top: "50%", marginTop: -17, width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: GREEN, fontWeight: "bold", fontSize: 18 }}>‹</Text>
          </Pressable>
        )}
        {!editMode && siblings.index !== -1 && siblings.index < siblings.list.length - 1 && (
          <Pressable
            onPress={() => goSibling(1)}
            style={{ position: "absolute", right: 10, top: "50%", marginTop: -17, width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: GREEN, fontWeight: "bold", fontSize: 18 }}>›</Text>
          </Pressable>
        )}

        {activeMarker && (
          <TaskScreen marker={activeMarker} onClose={() => setActiveTaskId(null)} onToggle={toggleTask} onAdd={addTask} onDelete={deleteTask} onAddNote={addNoteLocal} onRemoveNote={removeNoteLocal} />
        )}
        {showAddMarker && (
          <NewPinForm title="Новая метка" confirmLabel="Добавить метку" showPlaceHints={currentId !== "home"} onClose={() => setShowAddMarker(false)} onCreate={createMarker} />
        )}
        {showAddScreen && <NewPinForm title="Новое поле" confirmLabel="Создать поле" showColor={false} imageAspect={[9, 16]} onClose={() => setShowAddScreen(false)} onCreate={createScreen} />}

        {showJournal && !journalDetail && (
          <JournalList entries={activeEntries} onClose={() => setShowJournal(false)} onOpenDetail={(e) => setJournalDetail({ screenId: e.screenId, markerId: e.markerId, taskId: e.task.id })} />
        )}
        {showJournal && journalDetail && journalDetailEntry && (
          <JournalDetail
            entry={journalDetailEntry}
            onBack={() => setJournalDetail(null)}
            onClose={() => {
              setJournalDetail(null);
              setShowJournal(false);
            }}
            onAddNote={addNoteGlobal}
            onRemoveNote={removeNoteGlobal}
          />
        )}
        {showHistory && <HistoryList entries={historyEntries} onClose={() => setShowHistory(false)} onDeleteEntry={hardDeleteEntry} />}

        {pendingDelete && (
          <ConfirmDialog
            message={`Удалить метку «${pendingDelete.name}»?`}
            onCancel={() => setPendingDelete(null)}
            onConfirm={() => {
              deleteMarker(pendingDelete.id);
              setPendingDelete(null);
            }}
          />
        )}
        {pendingDeleteField && (
          <ConfirmDialog
            message={`Удалить поле «${pendingDeleteField.name}» вместе со всеми метками?`}
            onCancel={() => setPendingDeleteField(null)}
            onConfirm={() => {
              deleteField(pendingDeleteField.id);
              setPendingDeleteField(null);
            }}
          />
        )}
      </View>

      <View style={{ borderTopWidth: 3, borderColor: INK, borderStyle: "dashed", backgroundColor: PAPER, padding: 10 }}>
        {!editMode ? (
          <View style={{ flexDirection: "row", gap: 6, justifyContent: "center", alignItems: "center" }}>
            <Chip
              label="📖 Журнал"
              onPress={() => {
                setShowHistory(false);
                setShowJournal(true);
              }}
              style={{ borderRadius: 18, backgroundColor: "#fff" }}
            />
            <Chip
              label="🕓 История"
              onPress={() => {
                setShowJournal(false);
                setJournalDetail(null);
                setShowHistory(true);
              }}
              style={{ borderRadius: 18, backgroundColor: "#fff" }}
            />
            <Chip
              label="✎ Редактировать"
              onPress={() => {
                setActiveTaskId(null);
                setShowJournal(false);
                setJournalDetail(null);
                setShowHistory(false);
                setEditMode(true);
              }}
              style={{ borderRadius: 18, backgroundColor: "#fff" }}
            />
            <Pressable onPress={() => setShowAddMarker(true)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff", borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 16 }}>＋</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 4 }}>
            <Pressable onPress={() => setEditAction("move")} style={{ flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 12, backgroundColor: editAction === "move" ? INK : "transparent" }}>
              <Text style={{ fontSize: 15 }}>{editAction === "move" ? "" : ""}✥</Text>
              <Text style={{ fontSize: 9.5, fontWeight: "bold", color: editAction === "move" ? "#fff" : INK }}>Двигать</Text>
            </Pressable>
            <Pressable onPress={() => setShowAddMarker(true)} style={{ flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 12 }}>
              <Text style={{ fontSize: 15 }}>＋</Text>
              <Text style={{ fontSize: 9.5, fontWeight: "bold", color: INK }}>Метка</Text>
            </Pressable>
            <Pressable onPress={() => setShowAddScreen(true)} style={{ flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 12 }}>
              <Text style={{ fontSize: 15 }}>▤</Text>
              <Text style={{ fontSize: 9.5, fontWeight: "bold", color: INK }}>Поле</Text>
            </Pressable>
            <Pressable onPress={() => setEditAction("delete")} style={{ flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 12, backgroundColor: editAction === "delete" ? INK : "transparent" }}>
              <Text style={{ fontSize: 15 }}>🗑</Text>
              <Text style={{ fontSize: 9.5, fontWeight: "bold", color: editAction === "delete" ? "#fff" : INK }}>Удалить</Text>
            </Pressable>
            <Pressable onPress={() => setEditMode(false)} style={{ flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 12, backgroundColor: GREEN }}>
              <Text style={{ fontSize: 15 }}>✓</Text>
              <Text style={{ fontSize: 9.5, fontWeight: "bold", color: "#fff" }}>Готово</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
