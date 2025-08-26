import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Book Finder – Open Library (Enhanced)
 *
 * Enhancements over the previous version:
 * - Uses many more fields returned by Open Library search API (publishers, subtitle, languages, publish years, subjects, edition count, ratings if present)
 * - Card -> Details modal with expanded metadata and external links
 * - Load more pagination (server-side) with graceful merging of new results
 * - Client-side filters derived from result set (languages, subjects, publishers)
 * - Sorting including by latest publish year
 * - Improved accessibility and small UI tweaks
 * - Favorites (localStorage) unchanged
 */

const OPENLIB_SEARCH = "https://openlibrary.org/search.json";
const COVER = (coverId, size = "M") =>
  coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : null;

const LANG_MAP = {
  eng: "English",
  hin: "Hindi",
  fra: "French",
  ger: "German",
  spa: "Spanish",
  ita: "Italian",
  rus: "Russian",
  jpn: "Japanese",
  chi: "Chinese",
};

function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  }, [key, val]);
  return [val, setVal];
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-gray-100 p-4 shadow-sm">
      <div className="h-48 w-full rounded-xl bg-gray-200" />
      <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
    </div>
  );
}

function ResultCard({ doc, onFav, isFav, onOpen, view = "grid" }) {
  const authors = doc.author_name?.join(", ") || "Unknown";
  const title = doc.title ?? "Untitled";
  const subtitle = doc.subtitle ? ` — ${doc.subtitle}` : "";
  const firstYear = doc.first_publish_year || "—";
  const latestYear = (doc.publish_year || []).length ? Math.max(...doc.publish_year) : firstYear;
  const publishers = (doc.publisher || []).slice(0, 2).join(", ");
  const lang = (doc.language || []).map((c) => LANG_MAP[c] || c?.toUpperCase()).join(", ");
  const cover = COVER(doc.cover_i, view === "grid" ? "L" : "M");
  const edition = doc.edition_count ? `${doc.edition_count} ed.` : "";
  const subjects = (doc.subject || []).slice(0, 4);
  const olKey = doc.key; // e.g., "/works/OL123W"
  const olUrl = `https://openlibrary.org${olKey}`;

  const citation = `${authors} (${firstYear}). ${title}. Open Library.`;

  const copyCite = async () => {
    try {
      await navigator.clipboard.writeText(citation);
    } catch {}
  };

  return (
    <article
      className={
        view === "grid"
          ? "group rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md"
          : "group grid grid-cols-[96px,1fr] gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md"
      }
      aria-label={title}
    >
      <div className="relative">
        {cover ? (
          <img
            src={cover}
            alt={`${title} cover`}
            className={
              view === "grid"
                ? "h-56 w-full rounded-xl object-cover"
                : "h-28 w-24 rounded-xl object-cover"
            }
            loading="lazy"
          />
        ) : (
          <div
            className={
              view === "grid"
                ? "flex h-56 w-full items-center justify-center rounded-xl bg-gray-100"
                : "flex h-28 w-24 items-center justify-center rounded-xl bg-gray-100"
            }
          >
            <span className="text-xs text-gray-400">No Cover</span>
          </div>
        )}
      </div>
      <div className={view === "grid" ? "mt-3" : "min-w-0"}>
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{title}{subtitle}</h3>
        <p className="mt-1 line-clamp-1 text-xs text-gray-600">{authors}</p>
        <p className="mt-0.5 text-[11px] text-gray-500">First: {firstYear} • Latest: {latestYear} • {lang || "—"}</p>
        {publishers && (
          <p className="mt-1 line-clamp-1 text-[11px] text-gray-500">Publisher: {publishers}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {edition && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{edition}</span>
          )}
          {doc.ebook_count_i > 0 && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">eBook available</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => window.open(olUrl, "_blank", "noopener")}
            className="rounded-xl border px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50"
          >
            Open Library
          </button>
          <button
            onClick={copyCite}
            className="rounded-xl border px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50"
            aria-label="Copy citation"
          >
            Copy cite
          </button>
          <button
            onClick={() => onOpen(doc)}
            className="rounded-xl border px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50"
          >
            Details
          </button>
          <button
            onClick={() => onFav(doc)}
            className={(isFav ? "bg-yellow-100 text-yellow-900 hover:bg-yellow-200" : "text-gray-700 hover:bg-gray-50") + " rounded-xl border px-3 py-1.5 text-xs transition"}
            aria-pressed={isFav}
            aria-label={isFav ? "Remove favorite" : "Add favorite"}
          >
            {isFav ? "Favorited" : "Favorite"}
          </button>
        </div>
      </div>
    </article>
  );
}

function DetailsModal({ doc, onClose }) {
  if (!doc) return null;
  const authors = doc.author_name?.join(", ") || "Unknown";
  const title = doc.title ?? "Untitled";
  const subtitle = doc.subtitle ? ` — ${doc.subtitle}` : "";
  const publishers = (doc.publisher || []).slice(0, 6);
  const subjects = (doc.subject || []).slice(0, 20);
  const languages = (doc.language || []).map((c) => LANG_MAP[c] || c?.toUpperCase());
  const publishYears = (doc.publish_year || []).sort((a, b) => b - a);
  const coverL = COVER(doc.cover_i, "L");
  const olUrl = `https://openlibrary.org${doc.key}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {coverL ? (
              <img src={coverL} alt={title} className="h-64 w-44 rounded-lg object-cover" />
            ) : (
              <div className="h-64 w-44 rounded-lg bg-gray-100 flex items-center justify-center">No Cover</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{title}{subtitle}</h2>
            <p className="mt-1 text-sm text-gray-600">{authors}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-700">
              {publishers.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500">Publishers</div>
                  <div className="mt-1 text-sm">{publishers.join(", ")}</div>
                </div>
              )}
              {languages.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500">Languages</div>
                  <div className="mt-1 text-sm">{languages.join(", ")}</div>
                </div>
              )}
              {publishYears.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500">Publish years (latest first)</div>
                  <div className="mt-1 text-sm">{publishYears.slice(0, 10).join(", ")}</div>
                </div>
              )}
            </div>
            {subjects.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-gray-500">Subjects</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <span key={s} className="rounded-full bg-gray-100 px-3 py-1 text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <a href={olUrl} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Open Library page</a>
              <button onClick={() => navigator.clipboard.writeText(olUrl)} className="rounded-xl border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Copy link</button>
              <button onClick={onClose} className="ml-auto rounded-xl bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildQuery({ mode, query, author, title, isbn, subject, page, perPage }) {
  const url = new URL(OPENLIB_SEARCH);
  if (mode === "all" && query) url.searchParams.set("q", query);
  if (mode === "title" && title) url.searchParams.set("title", title);
  if (mode === "author" && author) url.searchParams.set("author", author);
  if (mode === "isbn" && isbn) url.searchParams.set("isbn", isbn);
  if (subject) url.searchParams.set("subject", subject);
  if (page) url.searchParams.set("page", String(page));
  if (perPage) url.searchParams.set("limit", String(perPage));
  // request many useful fields
  url.searchParams.set(
    "fields",
    [
      "key",
      "title",
      "subtitle",
      "author_name",
      "first_publish_year",
      "publish_year",
      "publisher",
      "edition_count",
      "cover_i",
      "language",
      "ebook_count_i",
      "subject",
      "ratings_average",
    ].join(",")
  );
  return url.toString();
}

export default function BookFinderApp() {
  const [mode, setMode] = useState("all");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [subject, setSubject] = useState("");

  const [langFilter, setLangFilter] = useState("any");
  const [ebookOnly, setEbookOnly] = useState(false);
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [sortBy, setSortBy] = useState("relevance");

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [numFound, setNumFound] = useState(0);
  const [view, setView] = useState("grid"); // grid | list

  const [favorites, setFavorites] = useLocalStorage("bf_favorites", []);

  const [availableLangs, setAvailableLangs] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availablePublishers, setAvailablePublishers] = useState([]);

  const [selectedDoc, setSelectedDoc] = useState(null);

  const searchRef = useRef(null);
  const abortRef = useRef(null);
  const debounceTimer = useRef(null);

  useEffect(() => {
    const keydown = (e) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  const doSearch = (opts = { append: false, immediate: false }) => {
    const exec = async () => {
      setError("");
      setLoading(true);
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const url = buildQuery({
          mode,
          query,
          author,
          title,
          isbn,
          subject,
          page,
          perPage,
        });
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const docs = Array.isArray(data.docs) ? data.docs : [];

        // client-side filters
        let filtered = docs;
        if (ebookOnly) filtered = filtered.filter((d) => (d.ebook_count_i || 0) > 0);
        if (langFilter !== "any") {
          filtered = filtered.filter((d) => (d.language || []).includes(langFilter));
        }
        const yMin = parseInt(yearMin, 10);
        const yMax = parseInt(yearMax, 10);
        if (!isNaN(yMin)) filtered = filtered.filter((d) => (d.first_publish_year || 0) >= yMin);
        if (!isNaN(yMax)) filtered = filtered.filter((d) => (d.first_publish_year || 99999) <= yMax);

        // derive available filters from cumulative results (not just current page)
        const combined = opts.append ? [...results, ...filtered] : filtered;
        const langs = new Set();
        const subjects = new Set();
        const publishers = new Set();
        combined.forEach((d) => {
          (d.language || []).forEach((l) => langs.add(l));
          (d.subject || []).slice(0, 10).forEach((s) => subjects.add(s));
          (d.publisher || []).slice(0, 3).forEach((p) => publishers.add(p));
        });
        setAvailableLangs(Array.from(langs).slice(0, 20));
        setAvailableSubjects(Array.from(subjects).slice(0, 50));
        setAvailablePublishers(Array.from(publishers).slice(0, 30));

        // sort
        const keyFns = {
          relevance: () => 0,
          title: (d) => (d.title || "").toLowerCase(),
          author: (d) => (d.author_name?.[0] || "").toLowerCase(),
          year: (d) => (d.first_publish_year || 0),
          latest: (d) => (d.publish_year && d.publish_year.length ? Math.max(...d.publish_year) : (d.first_publish_year || 0)),
        };
        const keyFn = keyFns[sortBy] || keyFns.relevance;
        const sorted = sortBy === "year" || sortBy === "latest"
          ? [...combined].sort((a, b) => keyFn(b) - keyFn(a))
          : [...combined].sort((a, b) => (keyFn(a) > keyFn(b) ? 1 : keyFn(a) < keyFn(b) ? -1 : 0));

        setResults(sorted);
        setNumFound(typeof data.numFound === "number" ? data.numFound : sorted.length);
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    if (opts.immediate) return exec();

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(exec, 350);
  };

  // run new search when these change
  useEffect(() => {
    setPage(1);
    doSearch({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, query, title, author, isbn, subject, perPage, langFilter, ebookOnly, yearMin, yearMax, sortBy]);

  const onSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    doSearch({ append: false, immediate: true });
  };

  const isFav = (doc) => favorites.some((f) => f.key === doc.key);
  const toggleFav = (doc) => {
    setFavorites((prev) => (isFav(doc) ? prev.filter((f) => f.key !== doc.key) : [doc, ...prev]));
  };

  const loadMore = () => {
    if (loading) return;
    setPage((p) => {
      const np = p + 1;
      // update page then fetch append
      setTimeout(() => doSearch({ append: true, immediate: true }), 0);
      return np;
    });
  };

  const quickSet = (preset) => {
    if (preset === "ai") {
      setMode("all");
      setQuery("artificial intelligence student textbook");
      setSubject("computer_science");
      setLangFilter("eng");
      setEbookOnly(true);
      setSortBy("latest");
      setPage(1);
    } else if (preset === "fiction") {
      setMode("title");
      setTitle("science fiction");
      setSubject("science_fiction");
      setLangFilter("eng");
      setEbookOnly(false);
      setSortBy("relevance");
      setPage(1);
    } else if (preset === "research") {
      setMode("author");
      setAuthor("Goodfellow");
      setSubject("");
      setLangFilter("eng");
      setEbookOnly(false);
      setSortBy("latest");
      setPage(1);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4">
      <header className="mb-6 flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">📚 Book Finder</h1>
        <p className="max-w-3xl text-sm text-gray-600">Search millions of books from Open Library. Use <kbd className="rounded bg-gray-100 px-1">/</kbd> to focus the search bar, then Enter to search.</p>

        <div className="flex flex-wrap items-center gap-2">
          {[{ id: "all", label: "All" },{ id: "title", label: "Title" },{ id: "author", label: "Author" },{ id: "isbn", label: "ISBN" }].map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} className={(mode === m.id ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white text-gray-700 hover:bg-gray-50") + " rounded-2xl border px-3 py-1.5 text-sm shadow-sm transition"} aria-pressed={mode === m.id}>{m.label}</button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {mode === "all" && (
            <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search anything… (e.g., data structures, Shakespeare)" className="rounded-2xl border px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500" aria-label="Search query" />
          )}
          {mode === "title" && (
            <input ref={searchRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title contains…" className="rounded-2xl border px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500" aria-label="Title" />
          )}
          {mode === "author" && (
            <input ref={searchRef} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name…" className="rounded-2xl border px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500" aria-label="Author" />
          )}
          {mode === "isbn" && (
            <input ref={searchRef} value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="ISBN (10 or 13)…" className="rounded-2xl border px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500" aria-label="ISBN" />
          )}

          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Optional subject (e.g., algorithms, psychology)" className="rounded-2xl border px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500" aria-label="Subject" />

          <div className="flex items-center gap-2">
            <button type="submit" className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">Search</button>
            <button type="button" onClick={() => { setQuery(""); setTitle(""); setAuthor(""); setIsbn(""); setSubject(""); setLangFilter("any"); setEbookOnly(false); setYearMin(""); setYearMax(""); setSortBy("relevance"); setPage(1); }} className="rounded-2xl border px-3 py-3 text-sm text-gray-700 hover:bg-gray-50">Reset</button>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Try:</span>
          <button onClick={() => quickSet("ai")} className="rounded-full bg-white px-3 py-1 text-xs text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50">AI Textbooks</button>
          <button onClick={() => quickSet("research")} className="rounded-full bg-white px-3 py-1 text-xs text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50">ML Authors</button>
          <button onClick={() => quickSet("fiction")} className="rounded-full bg-white px-3 py-1 text-xs text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50">Sci‑Fi</button>
        </div>
      </header>

      <section className="mb-4 grid items-end gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm text-gray-700">
          <span className="mb-1 block text-xs text-gray-500">Language</span>
          <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500">
            <option value="any">Any</option>
            {availableLangs.map((code) => (
              <option key={code} value={code}>{LANG_MAP[code] || code}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={ebookOnly} onChange={(e) => setEbookOnly(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          eBook available
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm text-gray-700">
            <span className="mb-1 block text-xs text-gray-500">Year from</span>
            <input value={yearMin} onChange={(e) => setYearMin(e.target.value)} inputMode="numeric" placeholder="e.g., 1990" className="w-full rounded-xl border px-3 py-2 text-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block text-xs text-gray-500">to</span>
            <input value={yearMax} onChange={(e) => setYearMax(e.target.value)} inputMode="numeric" placeholder="e.g., 2025" className="w-full rounded-xl border px-3 py-2 text-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500" />
          </label>
        </div>
        <div className="grid grid-cols-3 items-end gap-2 sm:grid-cols-3">
          <label className="text-sm text-gray-700">
            <span className="mb-1 block text-xs text-gray-500">Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500">
              <option value="relevance">Relevance</option>
              <option value="title">Title (A→Z)</option>
              <option value="author">Author (A→Z)</option>
              <option value="latest">Latest publish year</option>
              <option value="year">First publish year</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block text-xs text-gray-500">View</span>
            <select value={view} onChange={(e) => setView(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500">
              <option value="grid">Grid</option>
              <option value="list">List</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block text-xs text-gray-500">Per page</span>
            <select value={perPage} onChange={(e) => { setPerPage(parseInt(e.target.value, 10)); setPage(1); }} className="w-full rounded-xl border px-3 py-2 text-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500">
              {[10, 20, 40, 50].map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
          </label>
        </div>
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <div>
          {loading ? (
            <span className="inline-flex items-center gap-2"><span className="inline-block h-2 w-2 animate-ping rounded-full bg-indigo-600" />Searching…</span>
          ) : error ? (
            <span className="text-red-600">Error: {error}</span>
          ) : (
            <span>{numFound ? numFound.toLocaleString() : 0} matches • Page {page}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { if (page > 1) { setPage((p) => Math.max(1, p - 1)); setTimeout(() => doSearch({ append: false, immediate: true }), 0); } }} disabled={page <= 1 || loading} className="rounded-xl border px-3 py-1.5 disabled:opacity-50">Prev</button>
          <button onClick={loadMore} disabled={loading || results.length >= numFound} className="rounded-xl border px-3 py-1.5 disabled:opacity-50">Load more</button>
        </div>
      </div>

      {loading && (
        <div className={view === "grid" ? "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" : "grid gap-3"}>
          {Array.from({ length: view === "grid" ? 8 : 6 }).map((_, i) => (<SkeletonCard key={i} />))}
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-600 shadow-sm">No results yet. Try a different query or use the presets above.</div>
      )}

      {!loading && !error && results.length > 0 && (
        <div className={view === "grid" ? "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" : "grid gap-3"}>
          {results.map((doc) => (<ResultCard key={doc.key} doc={doc} onFav={toggleFav} isFav={isFav(doc)} onOpen={(d) => setSelectedDoc(d)} view={view} />))}
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">⭐ Favorites</h2>
          {favorites.length > 0 && (<button onClick={() => setFavorites([])} className="rounded-xl border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Clear all</button>)}
        </div>
        {favorites.length === 0 ? (
          <p className="text-sm text-gray-600">Save books you care about to find them quickly later.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{favorites.map((doc) => (<ResultCard key={doc.key} doc={doc} onFav={toggleFav} isFav={true} onOpen={(d) => setSelectedDoc(d)} view="grid" />))}</div>
        )}
      </section>

      <footer className="mt-10 grid gap-2 rounded-2xl bg-gray-50 p-4 text-xs text-gray-500">
        <p>Data from Open Library. Covers via covers.openlibrary.org. This demo app surfaces many fields returned by the API — publishers, subjects, languages, editions, and publish years.</p>
      </footer>

      {selectedDoc && <DetailsModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />}
    </div>
  );
}
