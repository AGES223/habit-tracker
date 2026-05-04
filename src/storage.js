import { hasSupabaseConfig, supabase } from "./supabaseClient";

const HABITS_KEY = "ht_habits";
const COMPLETIONS_KEY = "ht_completions";

function localStore() {
  return {
    get: async (key) => {
      const value = localStorage.getItem(key);
      return value ? { value } : null;
    },
    set: async (key, value) => {
      localStorage.setItem(key, value);
      return true;
    },
  };
}

async function getSessionUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

function completionRowsToMap(rows) {
  return Object.fromEntries(
    rows.map((row) => [`${row.habit_id}_${new Date(row.completed_on).toDateString()}`, true])
  );
}

function mapToCompletionRows(completions, userId) {
  return Object.keys(completions)
    .filter((key) => completions[key])
    .map((key) => {
      const splitAt = key.indexOf("_");
      return {
        user_id: userId,
        habit_id: Number(key.slice(0, splitAt)),
        completed_on: new Date(key.slice(splitAt + 1)).toISOString().slice(0, 10),
      };
    });
}

async function getCloudValue(key) {
  const userId = await getSessionUserId();
  if (!userId) return localStore().get(key);

  if (key === HABITS_KEY) {
    const { data, error } = await supabase
      .from("habits")
      .select("id,name,color,category,note,weekdays_only,created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const habits = data.map((row) => ({
      id: Number(row.id),
      name: row.name,
      color: row.color,
      category: row.category,
      note: row.note || "",
      weekdaysOnly: row.weekdays_only,
    }));
    return { value: JSON.stringify(habits) };
  }

  if (key === COMPLETIONS_KEY) {
    const { data, error } = await supabase
      .from("habit_completions")
      .select("habit_id,completed_on")
      .order("completed_on", { ascending: true });
    if (error) throw error;
    return { value: JSON.stringify(completionRowsToMap(data)) };
  }

  return localStore().get(key);
}

async function setCloudValue(key, value) {
  const userId = await getSessionUserId();
  if (!userId) return localStore().set(key, value);

  if (key === HABITS_KEY) {
    const habits = JSON.parse(value || "[]");
    const ids = habits.map((habit) => Number(habit.id));
    const rows = habits.map((habit) => ({
      id: Number(habit.id),
      user_id: userId,
      name: habit.name,
      color: habit.color,
      category: habit.category,
      note: habit.note || "",
      weekdays_only: Boolean(habit.weekdaysOnly),
    }));

    if (rows.length) {
      const { error } = await supabase.from("habits").upsert(rows, { onConflict: "id" });
      if (error) throw error;
    }

    const deleteQuery = supabase.from("habits").delete().eq("user_id", userId);
    const { error: deleteError } = ids.length ? await deleteQuery.not("id", "in", `(${ids.join(",")})`) : await deleteQuery;
    if (deleteError) throw deleteError;
    return true;
  }

  if (key === COMPLETIONS_KEY) {
    const completions = JSON.parse(value || "{}");
    const rows = mapToCompletionRows(completions, userId);
    const { error: deleteError } = await supabase
      .from("habit_completions")
      .delete()
      .eq("user_id", userId);
    if (deleteError) throw deleteError;

    if (rows.length) {
      const { error } = await supabase
        .from("habit_completions")
        .upsert(rows, { onConflict: "user_id,habit_id,completed_on" });
      if (error) throw error;
    }
    return true;
  }

  return localStore().set(key, value);
}

export function createHabitStorage() {
  if (!hasSupabaseConfig) return localStore();
  return {
    get: getCloudValue,
    set: setCloudValue,
  };
}

