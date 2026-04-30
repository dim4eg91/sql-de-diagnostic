const tests = {
  sql: {
    label: "SQL",
    completeTitle: "SQL-результат готов",
    topics: {
      joins: {
        title: "JOIN и связность",
        short: "JOIN",
        weight: 0.2,
        study: [
          "LEFT JOIN vs INNER JOIN: где фильтр в WHERE ломает смысл запроса.",
          "Grain после JOIN: почему метрики раздуваются после связи таблиц.",
        ],
      },
      nulls: {
        title: "NULL и трехзначная логика",
        short: "NULL",
        weight: 0.15,
        study: [
          "NOT IN, NOT EXISTS и NULL: почему анти-фильтр внезапно возвращает пустоту.",
          "COUNT(*), COUNT(column), IS NULL и UNKNOWN в условиях.",
        ],
      },
      aggregations: {
        title: "Агрегации и метрики",
        short: "Агрегации",
        weight: 0.17,
        study: [
          "GROUP BY, HAVING, ORDER BY и LIMIT для стабильных топов.",
          "Условия в агрегатах: SUM(CASE WHEN ...), COUNT(DISTINCT ...), корректный grain.",
        ],
      },
      windows: {
        title: "Оконные функции",
        short: "Окна",
        weight: 0.17,
        study: [
          "LAG, ROW_NUMBER, PARTITION BY: как считать внутри групп, не схлопывая строки.",
          "ROWS vs RANGE, ранжирование и дедупликация без лишних self join.",
        ],
      },
      dates: {
        title: "Даты и периоды",
        short: "Даты",
        weight: 0.1,
        study: [
          "Границы timestamp: почему BETWEEN часто портит месячные отчеты.",
          "Периоды через >= start и < next_start вместо ручной магии с датами.",
        ],
      },
      subqueries: {
        title: "Подзапросы и EXISTS",
        short: "EXISTS",
        weight: 0.11,
        study: [
          "EXISTS против JOIN: где нужен факт существования, а где нужны поля.",
          "Коррелированные подзапросы, анти-join и риск дублей.",
        ],
      },
      cte: {
        title: "CTE и декомпозиция",
        short: "CTE",
        weight: 0.1,
        study: [
          "CTE как способ разложить решение на читаемые шаги.",
          "ROW_NUMBER вместо GROUP BY, когда нужно выбрать строку целиком.",
        ],
      },
    },
    questions: [
      {
        topic: "aggregations",
        source: "SQL Junior: топы, сортировка, стабильный результат",
        title: "Нужно вывести топ-2 города по числу завершенных сделок. Что критично добавить к запросу?",
        sql: `select u.city, count(*) as completed_orders
from users u
join trades t on t.user_id = u.user_id
where t.status = 'Completed'
group by u.city
-- чего не хватает?`,
        answers: [
          { text: "ORDER BY completed_orders DESC, city ASC и LIMIT 2", correct: true },
          { text: "HAVING count(*) > 0 и LIMIT 2: после GROUP BY останутся только города со сделками", correct: false },
          { text: "COUNT(DISTINCT t.trade_id) без ORDER BY: агрегат сам задаст порядок строк", correct: false },
          { text: "ORDER BY max(t.created_at) DESC и LIMIT 2: свежие города и будут топом по сделкам", correct: false },
        ],
        explanation: "Топ без явной сортировки не является топом. Второй ключ сортировки нужен, чтобы результат не плавал на равных значениях.",
      },
      {
        topic: "joins",
        source: "SQL Junior: LEFT JOIN и фильтры по правой таблице",
        title: "Почему этот LEFT JOIN фактически превращается в INNER JOIN?",
        sql: `select c.customer_id, o.order_id
from customers c
left join orders o on o.customer_id = c.customer_id
where o.status = 'paid';`,
        answers: [
          { text: "Фильтр по правой таблице стоит в WHERE и выбрасывает NULL-строки", correct: true },
          { text: "Проблема только в отсутствии условия по дате заказа, сам LEFT JOIN не меняет семантику", correct: false },
          { text: "Нужно заменить LEFT JOIN на RIGHT JOIN, чтобы главной стала таблица orders", correct: false },
          { text: "CASE WHEN o.status = 'paid' в SELECT сохранит всех клиентов и одновременно отфильтрует заказы", correct: false },
        ],
        explanation: "WHERE o.status = 'paid' удаляет строки, где заказа нет и поля order равны NULL. Смысл LEFT JOIN ломается.",
      },
      {
        topic: "nulls",
        source: "SQL Junior: NOT IN и NULL",
        title: "Что случится с NOT IN, если подзапрос вернет хотя бы один NULL?",
        sql: `select *
from users
where user_id not in (
  select user_id
  from blocked_users
);`,
        answers: [
          { text: "Условие может уйти в UNKNOWN и вернуть не то, что ожидали", correct: true },
          { text: "NULL из подзапроса будет отброшен, если users.user_id объявлен NOT NULL", correct: false },
          { text: "Проблема появится только при отсутствии индекса на blocked_users.user_id", correct: false },
          { text: "Вернутся все пользователи, кроме тех, у кого user_id в основной таблице равен NULL", correct: false },
        ],
        explanation: "NOT IN плохо дружит с NULL. Для анти-фильтров чаще безопаснее думать в сторону NOT EXISTS или заранее чистить NULL.",
      },
      {
        topic: "aggregations",
        source: "SQL база: COUNT(*) vs COUNT(column)",
        title: "Когда COUNT(*) и COUNT(cancelled_at) дадут разные значения?",
        sql: `select
  count(*) as rows_cnt,
  count(cancelled_at) as cancelled_cnt
from orders;`,
        answers: [
          { text: "Когда cancelled_at содержит NULL", correct: true },
          { text: "Когда в orders есть дублирующиеся order_id", correct: false },
          { text: "Когда cancelled_at не входит в GROUP BY", correct: false },
          { text: "Когда cancelled_at заполнен только у отмененных заказов, но NULL в колонке нет", correct: false },
        ],
        explanation: "COUNT(column) считает только не-NULL значения, COUNT(*) считает строки.",
      },
      {
        topic: "windows",
        source: "SQL Junior/Middle: LAG и порядок внутри окна",
        title: "Что делает LAG(order_date) в этом запросе?",
        sql: `select
  customer_id,
  order_id,
  lag(order_date) over (
    partition by customer_id
    order by order_date
  ) as prev_order_date
from orders;`,
        answers: [
          { text: "Берет дату предыдущего заказа внутри каждого клиента", correct: true },
          { text: "Берет предыдущую дату по всей таблице, а PARTITION BY влияет только на вывод", correct: false },
          { text: "Возвращает минимальную дату заказа клиента при сортировке по возрастанию", correct: false },
          { text: "Сдвигает текущую строку назад и меняет физический порядок результата", correct: false },
        ],
        explanation: "LAG смотрит на предыдущее значение внутри окна, заданного PARTITION BY и ORDER BY.",
      },
      {
        topic: "dates",
        source: "SQL Junior/Middle: timestamp и границы периода",
        title: "Почему такой фильтр может сломать месячный отчет по timestamp?",
        sql: `where created_at between '2026-04-01' and '2026-04-30'`,
        answers: [
          { text: "События 30 апреля после 00:00 могут не попасть в результат", correct: true },
          { text: "30 апреля попадет целиком, но не попадут строки с timezone", correct: false },
          { text: "Проблема только в PostgreSQL; в аналитических БД BETWEEN по timestamp всегда полуинтервал", correct: false },
          { text: "Фильтр захватит 1 мая 00:00, если на created_at есть индекс", correct: false },
        ],
        explanation: "Для timestamp безопаснее писать полуинтервал: created_at >= '2026-04-01' and created_at < '2026-05-01'.",
      },
      {
        topic: "joins",
        source: "SQL Junior: grain после JOIN",
        title: "Почему после JOIN сумма выручки внезапно выросла?",
        sql: `select sum(o.amount)
from orders o
join order_items i on i.order_id = o.order_id;`,
        answers: [
          { text: "Заказ размножился по строкам товаров", correct: true },
          { text: "INNER JOIN оставил только заказы с товарами, поэтому сумму нужно чинить заменой на LEFT JOIN", correct: false },
          { text: "SUM(DISTINCT o.amount) восстановит grain заказа и безопасен для любых одинаковых сумм", correct: false },
          { text: "Проблема только в отсутствии GROUP BY по order_id, хотя сумма нужна на уровне всех заказов", correct: false },
        ],
        explanation: "Если одна строка заказа связалась с несколькими item-строками, order-level сумма начинает повторяться.",
      },
      {
        topic: "nulls",
        source: "SQL база: сравнение с NULL",
        title: "Почему фильтр через = NULL не найдет строки без даты отмены?",
        sql: `select *
from orders
where cancelled_at = null;`,
        answers: [
          { text: "Сравнение с NULL дает UNKNOWN; нужно писать cancelled_at IS NULL", correct: true },
          { text: "Нужно сравнивать с пустой строкой, потому что даты без значения хранятся как ''", correct: false },
          { text: "Нужно добавить индекс на cancelled_at, иначе NULL-условия не работают", correct: false },
          { text: "Нужно перенести условие в HAVING, потому что NULL проверяется только после GROUP BY", correct: false },
        ],
        explanation: "NULL не равен даже NULL. Проверка на отсутствие значения пишется через IS NULL.",
      },
      {
        topic: "windows",
        source: "SQL Junior/Middle: PARTITION BY",
        title: "Зачем PARTITION BY в оконной функции?",
        sql: `row_number() over (
  partition by customer_id
  order by order_date
)`,
        answers: [
          { text: "Чтобы расчет начинался заново внутри каждого customer_id", correct: true },
          { text: "Чтобы row_number был уникален глобально, а не внутри каждого клиента", correct: false },
          { text: "Чтобы база физически переложила таблицу по customer_id перед выполнением запроса", correct: false },
          { text: "Чтобы можно было фильтровать rn в WHERE этого же SELECT без подзапроса", correct: false },
        ],
        explanation: "PARTITION BY задает группы внутри окна. Строки не схлопываются, в отличие от GROUP BY.",
      },
      {
        topic: "subqueries",
        source: "SQL Junior/Middle: EXISTS против JOIN",
        title: "Нужно оставить заказы, у которых существует клиент. Что лучше выражает именно проверку существования?",
        sql: `-- нужен только факт, что клиент существует
select o.*
from orders o
where ...`,
        answers: [
          { text: "WHERE EXISTS (select 1 from customers c where c.customer_id = o.customer_id)", correct: true },
          { text: "INNER JOIN customers c ON c.customer_id = o.customer_id, даже если справочник может дать дубли", correct: false },
          { text: "LEFT JOIN customers c ON ... WHERE c.customer_id IS NOT NULL, не проверяя уникальность customers", correct: false },
          { text: "o.customer_id IN (select customer_id from customers), потому что IN всегда строит тот же план, что EXISTS", correct: false },
        ],
        explanation: "EXISTS проверяет факт существования и не размножает строки. JOIN нужен, когда действительно нужны поля из второй таблицы.",
      },
      {
        topic: "aggregations",
        source: "SQL Junior: WHERE vs HAVING",
        title: "Нужно оставить только клиентов с двумя и более заказами. Где правильно фильтровать COUNT(*)?",
        sql: `select customer_id, count(*) as orders_cnt
from orders
group by customer_id
-- где фильтр orders_cnt >= 2?`,
        answers: [
          { text: "В HAVING, потому что фильтр идет по агрегату", correct: true },
          { text: "В WHERE по alias orders_cnt, потому что SELECT уже описывает итоговую колонку", correct: false },
          { text: "В WHERE count(*) >= 2, если СУБД умеет проталкивать агрегаты", correct: false },
          { text: "В QUALIFY, потому что это фильтр после расчета любых группировок", correct: false },
        ],
        explanation: "WHERE фильтрует строки до агрегации, HAVING фильтрует группы после GROUP BY.",
      },
      {
        topic: "windows",
        source: "SQL Middle: ROWS vs RANGE",
        title: "Почему RANGE в окне по дате может дать неожиданный результат?",
        sql: `sum(amount) over (
  order by order_date
  range between interval '7 day' preceding and current row
)`,
        answers: [
          { text: "RANGE берет все строки в диапазоне значений order_date, включая повторы дат", correct: true },
          { text: "RANGE и ROWS совпадут, если order_date имеет тип date, а не timestamp", correct: false },
          { text: "RANGE считает календарные дни, но берет только одну строку на каждый день", correct: false },
          { text: "RANGE безопаснее ROWS, потому что автоматически решает tie-breaker по order_id", correct: false },
        ],
        explanation: "ROWS считает физические строки, RANGE работает по значениям ORDER BY. На повторяющихся датах это принципиально разные окна.",
      },
      {
        topic: "cte",
        source: "SQL Middle: выбрать последнюю строку целиком",
        title: "Как корректно выбрать последний заказ каждого клиента, сохранив все поля заказа?",
        sql: `orders(customer_id, order_id, order_date, amount, status)`,
        answers: [
          { text: "ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) и rn = 1", correct: true },
          { text: "MAX(order_date) и JOIN обратно по customer_id/date, этого достаточно даже при двух заказах в один день", correct: false },
          { text: "GROUP BY customer_id и ANY_VALUE(order_id, amount), потому что max(order_date) уже выбрал строку", correct: false },
          { text: "DISTINCT ON (customer_id) без детерминированного ORDER BY, чтобы не считать окно", correct: false },
        ],
        explanation: "GROUP BY + MAX(date) не возвращает строку целиком. ROW_NUMBER позволяет выбрать конкретную строку внутри клиента.",
      },
      {
        topic: "aggregations",
        source: "SQL Junior/Middle: условные агрегаты",
        title: "Как посчитать выручку только по paid-заказам в той же группировке?",
        sql: `select customer_id,
       -- paid revenue?
from orders
group by customer_id;`,
        answers: [
          { text: "SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)", correct: true },
          { text: "SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)", correct: false },
          { text: "COUNT(CASE WHEN status = 'paid' THEN amount END)", correct: false },
          { text: "WHERE status = 'paid' перед GROUP BY, даже если в этой же выборке нужны all-метрики", correct: false },
        ],
        explanation: "Условная агрегация позволяет считать несколько метрик в одном проходе и не ломать общий набор строк.",
      },
    ],
  },
  de: {
    label: "DE",
    completeTitle: "DE-результат готов",
    topics: {
      modeling: {
        title: "Модель слоев и grain",
        short: "Модель",
        weight: 0.16,
        study: [
          "RAW, STG, CORE, MARTS: зачем нужен каждый слой и где фиксируется бизнес-смысл.",
          "Grain факта и витрины: одна строка должна иметь четкий контракт.",
        ],
      },
      orchestration: {
        title: "Оркестрация и backfill",
        short: "Airflow",
        weight: 0.18,
        study: [
          "Airflow run_id, dag_run.conf, params и связь audit-записей с конкретным запуском.",
          "Идемпотентность DAG: повторный запуск не должен размножать данные.",
        ],
      },
      spark: {
        title: "Spark и физика вычислений",
        short: "Spark",
        weight: 0.18,
        study: [
          "Shuffle, repartition, coalesce: где меняется число партиций и цена выполнения.",
          "DataFrame API и Spark SQL: одна логика, разные способы выражения.",
        ],
      },
      storage: {
        title: "Хранение и файлы",
        short: "Storage",
        weight: 0.16,
        study: [
          "Parquet, partitionBy и small files: физическая структура тоже часть решения.",
          "Partition pruning: когда партиционирование помогает, а когда просто плодит папки.",
        ],
      },
      quality: {
        title: "Data Quality и контроль",
        short: "DQ",
        weight: 0.16,
        study: [
          "Smoke-check против полноценного DQ: быстрая проверка не заменяет контракт качества.",
          "Reconciliation: сверка источника и результата по count, суммам, датам и batch id.",
        ],
      },
      contracts: {
        title: "Контракты и изменения схем",
        short: "Контракты",
        weight: 0.16,
        study: [
          "Schema drift: новые поля, исчезнувшие колонки и изменение типа не должны ломать пайплайн молча.",
          "Контракт входа и выхода: что pipeline обещает потребителю.",
        ],
      },
    },
    questions: [
      {
        topic: "modeling",
        source: "DE: слои хранилища",
        title: "Зачем разделять RAW, STG, CORE и MARTS, если можно сразу собрать одну большую таблицу?",
        sql: `raw -> stg -> core -> marts`,
        answers: [
          { text: "Чтобы отделить сырой вход, очистку, бизнес-модель и потребительские витрины", correct: true },
          { text: "Чтобы MARTS были местом исправления качества RAW, а STG оставался только архивом файлов", correct: false },
          { text: "Чтобы STG уже содержал бизнес-метрики, а CORE хранил только технические логи загрузки", correct: false },
          { text: "Чтобы при изменении источника переписывать только BI-отчеты, не трогая pipeline", correct: false },
        ],
        explanation: "Слои нужны не для красоты. Они разделяют ответственность и позволяют отлаживать пайплайн по шагам.",
      },
      {
        topic: "orchestration",
        source: "DE: audit и run_id",
        title: "Зачем в audit-таблице хранить run_id?",
        sql: `dag_id, task_id, run_id, event_type, ingest_date`,
        answers: [
          { text: "Чтобы связать события с конкретным запуском DAG", correct: true },
          { text: "ingest_date достаточно: два ручных запуска за одну дату можно различить по task_id", correct: false },
          { text: "run_id нужен только для UI Airflow, в audit лучше хранить только execution_date", correct: false },
          { text: "run_id можно заменить max(event_time), если события пишутся последовательно", correct: false },
        ],
        explanation: "Без run_id расследование падений превращается в кашу: непонятно, какой запуск что записал.",
      },
      {
        topic: "orchestration",
        source: "DE: идемпотентность",
        title: "Что означает идемпотентный batch DAG?",
        sql: `run same ingest_date twice`,
        answers: [
          { text: "Повторный запуск за ту же дату не должен дублировать или портить результат", correct: true },
          { text: "Перед каждым запуском нужно truncate всей целевой таблицы, тогда дублей точно не будет", correct: false },
          { text: "Для retry достаточно писать append-only с новым run_id, а витрины потом разберутся", correct: false },
          { text: "Если DAG зеленый, повторный запуск за дату можно не поддерживать", correct: false },
        ],
        explanation: "Идемпотентность нужна для backfill, retry и ручных перезапусков. Без нее данные быстро размножаются.",
      },
      {
        topic: "quality",
        source: "DE: smoke-check",
        title: "Что должен ловить smoke-check после загрузки batch?",
        sql: `table = stg.orders
ingest_date = '2026-04-30'`,
        answers: [
          { text: "Грубую поломку: batch отсутствует, пустой или не соответствует базовому ожиданию", correct: true },
          { text: "Только count > 0: если строки есть, smoke-check можно считать полноценным DQ", correct: false },
          { text: "Полную сверку всех бизнес-метрик с BI-дашбордом за весь период", correct: false },
          { text: "Только наличие файла в storage, не читая целевую таблицу", correct: false },
        ],
        explanation: "Smoke-check не заменяет DQ. Он быстро показывает, прошла ли загрузка базовые проверки.",
      },
      {
        topic: "spark",
        source: "DE: Spark partitions",
        title: "Чем repartition обычно отличается от coalesce?",
        sql: `df.repartition(100)
df.coalesce(10)`,
        answers: [
          { text: "repartition делает shuffle, coalesce чаще уменьшает число партиций без полного shuffle", correct: true },
          { text: "coalesce почти без shuffle, значит его всегда безопаснее использовать перед широким join", correct: false },
          { text: "repartition меняет только metadata, если число партиций больше текущего", correct: false },
          { text: "После Catalyst optimizer обе операции обычно дают одинаковый физический план", correct: false },
        ],
        explanation: "Это вопрос цены выполнения. Нельзя механически менять партиции, не понимая shuffle.",
      },
      {
        topic: "storage",
        source: "DE: Parquet и partitionBy",
        title: "Что делает partitionBy при записи Parquet?",
        sql: `df.write.partitionBy("dt").parquet(path)`,
        answers: [
          { text: "Раскладывает файлы по папкам вида dt=..., помогая фильтрам по dt читать меньше данных", correct: true },
          { text: "Гарантирует partition pruning даже для запросов без фильтра по dt", correct: false },
          { text: "Создает по одному Spark executor на каждое значение dt", correct: false },
          { text: "Заменяет bucket/sort и автоматически решает проблему small files", correct: false },
        ],
        explanation: "partitionBy задает физическую раскладку. Она помогает только если фильтры используют partition column.",
      },
      {
        topic: "storage",
        source: "DE: small files",
        title: "Почему small files становятся проблемой в data lake?",
        sql: `thousands of tiny parquet files`,
        answers: [
          { text: "Планирование и чтение множества мелких файлов дают большой overhead", correct: true },
          { text: "Проблема лечится только увеличением executor memory, layout файлов не важен", correct: false },
          { text: "Это опасно только для CSV; у Parquet metadata почти бесплатная", correct: false },
          { text: "Если есть partition pruning, количество файлов внутри партиции уже не влияет", correct: false },
        ],
        explanation: "Spark и object storage платят цену за каждый файл. Иногда проблема не в объеме данных, а в количестве файлов.",
      },
      {
        topic: "modeling",
        source: "DE: wide mart и grain",
        title: "Что самое опасное при сборке wide-витрины из факта и измерений?",
        sql: `fct_order_items
left join dim_product
left join dim_seller
left join dim_customer`,
        answers: [
          { text: "Нарушить grain факта и размножить строки без явной ошибки", correct: true },
          { text: "LEFT JOIN безопасен для grain, потому что он не режет строки факта", correct: false },
          { text: "Главный риск в том, что в dimension-колонках появится слишком много NULL", correct: false },
          { text: "Если денормализовать все поля в одну таблицу, grain автоматически фиксируется", correct: false },
        ],
        explanation: "Wide-витрина опасна тем, что один неуникальный join может превратить одну строку факта в несколько.",
      },
      {
        topic: "contracts",
        source: "DE: schema drift",
        title: "Что делать, если источник внезапно поменял тип поля amount со string на object?",
        sql: `yesterday: amount = "120.50"
today: amount = {"value": 120.50, "currency": "RUB"}`,
        answers: [
          { text: "Зафиксировать нарушение контракта, остановить или развести обработку по версии схемы", correct: true },
          { text: "Сделать cast object to string, чтобы не ронять SLA, а смысл поправить потом", correct: false },
          { text: "Пропустить поле amount до следующего релиза, не поднимая инцидент", correct: false },
          { text: "Ориентироваться на row count: если число строк совпало, контракт не нарушен", correct: false },
        ],
        explanation: "Schema drift должен быть явным событием. Молчаливое приведение типов часто ломает метрики позже.",
      },
      {
        topic: "quality",
        source: "DE: reconciliation",
        title: "Какая проверка лучше всего ловит потерю строк между STG и CORE?",
        sql: `stg.orders -> core.fct_orders`,
        answers: [
          { text: "Сверка count и ключевых агрегатов по batch/date между слоями", correct: true },
          { text: "Зеленый DAG без exception: если task успешен, строки не могли потеряться", correct: false },
          { text: "Проверка, что target count > 0 в последней партиции", correct: false },
          { text: "Сравнение только max(updated_at) между слоями", correct: false },
        ],
        explanation: "Зеленый DAG не доказывает корректность данных. Нужна сверка результата с источником.",
      },
      {
        topic: "orchestration",
        source: "DE: параметры DAG",
        title: "Откуда лучше брать ingest_date при ручном запуске DAG?",
        sql: `dag_run.conf.get("ingest_date") or params["ingest_date"]`,
        answers: [
          { text: "Из dag_run.conf, а params использовать как fallback", correct: true },
          { text: "Из logical_date Airflow, потому что она всегда равна бизнес-дате загрузки", correct: false },
          { text: "Из системной даты worker-ноды, чтобы ручной запуск всегда был актуальным", correct: false },
          { text: "Из max(dt) + 1 в целевой таблице, чтобы pipeline сам догадался о следующей дате", correct: false },
        ],
        explanation: "Ручной запуск должен быть управляемым. Run Config дает контроль, params дает безопасное значение по умолчанию.",
      },
      {
        topic: "spark",
        source: "DE: Spark API vs SQL",
        title: "Зачем в учебном DE-практикуме одну и ту же логику иногда писать через DataFrame API и Spark SQL?",
        sql: `df.groupBy(...)
spark.sql("select ... group by ...")`,
        answers: [
          { text: "Чтобы понимать план и контракт данных, а не зависеть от одного синтаксиса", correct: true },
          { text: "Потому что DataFrame API всегда оптимизируется лучше, чем Spark SQL", correct: false },
          { text: "Потому что Spark SQL нужен только аналитикам, а DE должен избегать SQL", correct: false },
          { text: "Чтобы в проде держать две независимые реализации и сравнивать row count после каждой загрузки", correct: false },
        ],
        explanation: "Сильный DE понимает логику и физику выполнения. Синтаксис вторичен.",
      },
    ],
  },
};

const resultProfiles = [
  {
    min: 78,
    title: "Хорошая база. Осталось закрыть сложные случаи.",
    copy: "Главный риск уже не в синтаксисе, а в окнах, датах, CTE, grain и объяснении решения.",
  },
  {
    min: 55,
    title: "База есть, но есть слабые места.",
    copy: "Нужна практика на пограничных случаях: NULL, JOIN, агрегации, даты и выбор строки целиком.",
  },
  {
    min: 0,
    title: "Сначала нужно закрыть базу.",
    copy: "Начни с JOIN, GROUP BY, NULL, HAVING и простых оконных функций. Сложные задачи без базы дают случайный результат.",
  },
];

const courses = {
  sqlFoundation: {
    title: "SQL для аналитиков и инженеров данных",
    copy: "Если проседают JOIN, GROUP BY, NULL и простые фильтры, сначала нужен фундамент.",
    url: "https://stepik.org/a/210499",
    cta: "Открыть курс на Stepik",
  },
  sqlJunior: {
    title: "SQL-собеседование: 100 задач уровня Junior",
    copy: "Подходит, если база уже есть, но не хватает устойчивости, скорости и ясного объяснения решения.",
    url: "https://stepik.org/a/240980",
    cta: "Открыть курс на Stepik",
  },
  sqlMiddle: {
    title: "SQL-собеседование: 100 задач уровня Middle",
    copy: "Подходит, когда базовые JOIN и GROUP BY уже не проблема, а ошибки появляются в окнах, CTE, датах и сложных агрегациях.",
    url: "https://stepik.org/a/238112",
    cta: "Открыть курс на Stepik",
  },
  sqlJuniorMiddleProgram: {
    title: "SQL-собеседование: программа Junior → Middle",
    copy: "Если слабые места есть сразу в нескольких темах, лучше идти программой, а не закрывать темы случайными задачами.",
    url: "https://stepik.org/246785",
    cta: "Открыть программу на Stepik",
  },
  sqlUpperMiddleProgram: {
    title: "SQL-собеседование: программа Junior → Upper-Middle",
    copy: "Если база крепкая, развивай многоходовые запросы, окна, CTE, декомпозицию и объяснение решения.",
    url: "https://stepik.org/a/251214",
    cta: "Открыть Upper-Middle на Stepik",
  },
  dePracticum: {
    title: "DE Practicum",
    copy: "Если нужна практика по инженерной сборке данных: Spark, Airflow, DWH-слои, контракты, DQ и надежность пайплайна.",
    url: "https://kuzmin-dmitry.ru/de_practicum",
    cta: "Открыть лендинг DE",
  },
};

const els = {
  progressBar: document.querySelector("#diagnosticProgressBar"),
  questionProgress: document.querySelector("#questionProgress"),
  questionTitle: document.querySelector("#questionTitle"),
  questionSource: document.querySelector("#questionSource"),
  questionCodeWrap: document.querySelector("#questionCodeWrap"),
  questionSql: document.querySelector("#questionSql"),
  answerList: document.querySelector("#answerList"),
  restart: document.querySelector("#restartDiagnostic"),
  next: document.querySelector("#nextQuestion"),
  answerFeedback: document.querySelector("#answerFeedback"),
  score: document.querySelector("#diagnosticScore"),
  diagnosisTitle: document.querySelector("#diagnosisTitle"),
  diagnosisCopy: document.querySelector("#diagnosisCopy"),
  studyList: document.querySelector("#studyList"),
  courseTitle: document.querySelector("#courseTitle"),
  courseCopy: document.querySelector("#courseCopy"),
  courseLink: document.querySelector("#courseLink"),
  copyResult: document.querySelector("#copyResult"),
  resultStatus: document.querySelector("#resultStatus"),
  modeButtons: document.querySelectorAll("[data-mode]"),
};

let activeMode = "sql";
let state = createState(activeMode);

function createState(mode) {
  const questions = buildSessionQuestions(tests[mode].questions);
  return {
    mode,
    questions,
    currentIndex: 0,
    selectedAnswerIndex: null,
    answerConfirmed: false,
    answers: Array(questions.length).fill(null),
    completed: false,
    score: 0,
    topicScores: {},
    weakTopicKeys: [],
  };
}

function buildSessionQuestions(questions) {
  return shuffle(questions).map((question) => ({
    ...question,
    answers: shuffle(question.answers.map((answer) => ({ ...answer }))),
  }));
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function getConfig() {
  return tests[state.mode];
}

function getTopicMeta() {
  return getConfig().topics;
}

function getCurrentQuestion() {
  return state.questions[state.currentIndex];
}

function renderQuestion() {
  if (state.completed) {
    renderCompletionView();
    return;
  }

  const confirmedCount = getConfirmedAnswers().length;
  const question = getCurrentQuestion();
  const progress = Math.round((confirmedCount / state.questions.length) * 100);
  els.questionCodeWrap.hidden = false;
  els.progressBar.style.width = `${progress}%`;
  els.questionProgress.textContent = `Вопрос ${state.currentIndex + 1} из ${state.questions.length}`;
  els.questionSource.textContent = question.source;
  els.questionTitle.textContent = question.title;
  els.questionSql.textContent = question.sql;
  els.answerFeedback.textContent = state.answerConfirmed
    ? getFeedbackText(question)
    : "Выбери вариант. Ответ засчитается только после подтверждения.";

  renderAnswerButtons();
  updateActionButton();
}

function renderCompletionView() {
  const config = getConfig();
  const weakTopics = getWeakTopicLabels();

  els.progressBar.style.width = "100%";
  els.questionProgress.textContent = `${config.label}-диагностика завершена`;
  els.questionTitle.textContent = config.completeTitle;
  els.questionSource.textContent = `Слабые зоны: ${weakTopics}`;
  els.questionCodeWrap.hidden = true;
  els.answerList.innerHTML = `
    <article class="completion-card">
      <span class="completion-score">${state.score}%</span>
      <div>
        <p class="eyebrow">Тест завершен</p>
        <h3>Подробный разбор собран в блоке результата.</h3>
        <p>Там находятся слабые темы, рекомендации и ссылка на подходящий маршрут.</p>
        <a class="secondary-action link-action" href="#resultPanel">Перейти к результату</a>
      </div>
    </article>
  `;
  els.next.disabled = true;
  els.next.textContent = "Готово";
  els.answerFeedback.textContent = "";
}

function renderAnswerButtons() {
  const question = getCurrentQuestion();
  els.answerList.innerHTML = "";

  question.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    const marker = document.createElement("span");
    const label = document.createElement("span");

    button.type = "button";
    marker.className = "answer-marker";
    marker.textContent = String.fromCharCode(65 + index);
    label.textContent = answer.text;
    button.append(marker, label);

    button.classList.toggle("selected", state.selectedAnswerIndex === index && !state.answerConfirmed);
    button.classList.toggle("correct", state.answerConfirmed && answer.correct);
    button.classList.toggle("wrong", state.answerConfirmed && state.selectedAnswerIndex === index && !answer.correct);
    button.disabled = state.answerConfirmed;
    button.addEventListener("click", () => selectAnswer(index));
    els.answerList.appendChild(button);
  });
}

function selectAnswer(index) {
  if (state.completed || state.answerConfirmed) return;

  state.selectedAnswerIndex = index;
  renderAnswerButtons();
  updateActionButton();
  els.answerFeedback.textContent = "Выбор зафиксирован. Теперь нажми «Подтвердить выбор», чтобы увидеть разбор.";
}

function updateActionButton() {
  if (state.completed) return;

  if (!Number.isInteger(state.selectedAnswerIndex)) {
    els.next.disabled = true;
    els.next.textContent = "Выбери ответ";
    return;
  }

  els.next.disabled = false;
  if (!state.answerConfirmed) {
    els.next.textContent = "Подтвердить выбор";
    return;
  }

  els.next.textContent = state.currentIndex === state.questions.length - 1
    ? "Показать результат"
    : "Следующий вопрос";
}

function handlePrimaryAction() {
  if (!Number.isInteger(state.selectedAnswerIndex)) return;

  if (!state.answerConfirmed) {
    confirmAnswer();
    return;
  }

  if (state.currentIndex >= state.questions.length - 1) {
    completeDiagnostic();
    return;
  }

  state.currentIndex += 1;
  state.selectedAnswerIndex = null;
  state.answerConfirmed = false;
  renderQuestion();
}

function confirmAnswer() {
  const question = getCurrentQuestion();
  const selectedAnswer = question.answers[state.selectedAnswerIndex];
  const correctAnswer = question.answers.find((answer) => answer.correct);

  state.answerConfirmed = true;
  state.answers[state.currentIndex] = {
    topic: question.topic,
    correct: selectedAnswer.correct,
    selectedText: selectedAnswer.text,
    correctText: correctAnswer.text,
  };

  renderAnswerButtons();
  updateActionButton();
  renderLiveResult();
  els.answerFeedback.textContent = getFeedbackText(question);
}

function getFeedbackText(question) {
  const answer = state.answers[state.currentIndex];
  if (!answer) return question.explanation;
  return answer.correct
    ? question.explanation
    : `Неверно. Правильный ответ: ${answer.correctText}. ${question.explanation}`;
}

function completeDiagnostic() {
  state.topicScores = calculateTopicScores();
  state.score = calculateReadiness(state.topicScores);
  state.weakTopicKeys = getWeakTopicKeys(state.topicScores);
  state.completed = true;
  renderResult();
  renderQuestion();
}

function getConfirmedAnswers() {
  return state.answers.filter(Boolean);
}

function calculateTopicScores() {
  const grouped = {};
  state.questions.forEach((question, index) => {
    if (!grouped[question.topic]) grouped[question.topic] = { correct: 0, total: 0 };
    grouped[question.topic].total += 1;
    if (state.answers[index]?.correct) grouped[question.topic].correct += 1;
  });

  return Object.fromEntries(
    Object.entries(grouped).map(([topic, value]) => [
      topic,
      Math.round((value.correct / value.total) * 100),
    ])
  );
}

function calculateReadiness(topicScores) {
  const topics = getTopicMeta();
  return Math.round(
    Object.entries(topics).reduce((sum, [topic, meta]) => {
      return sum + (topicScores[topic] || 0) * meta.weight;
    }, 0)
  );
}

function getWeakTopicKeys(topicScores) {
  return Object.entries(topicScores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([topic]) => topic);
}

function renderLiveResult() {
  const confirmed = getConfirmedAnswers();
  const correct = confirmed.filter((answer) => answer.correct).length;
  const liveScore = confirmed.length ? Math.round((correct / confirmed.length) * 100) : 0;
  els.score.textContent = `${liveScore}%`;
  els.score.style.setProperty("--score", `${liveScore}%`);
}

function renderResult() {
  const profile = getResultProfile();
  const studyItems = getStudyItems();
  const course = getRecommendedCourse();

  els.score.textContent = `${state.score}%`;
  els.score.style.setProperty("--score", `${state.score}%`);
  els.diagnosisTitle.textContent = profile.title;
  els.diagnosisCopy.textContent = profile.copy;
  els.studyList.innerHTML = studyItems.map((item) => `<li>${item}</li>`).join("");
  els.courseTitle.textContent = course.title;
  els.courseCopy.textContent = course.copy;
  els.courseLink.href = course.url;
  els.courseLink.textContent = course.cta;
  els.copyResult.disabled = false;
  els.resultStatus.textContent = "Результат не сохраняется. Его можно скопировать.";
}

function getResultProfile() {
  if (!state.completed) return resultProfiles[resultProfiles.length - 1];
  return resultProfiles.find((profile) => state.score >= profile.min);
}

function getStudyItems() {
  if (!state.completed) {
    return [`Ответь на вопросы ${getConfig().label}-диагностики, и здесь появятся конкретные слабые места.`];
  }

  return state.weakTopicKeys
    .flatMap((topic) => getTopicMeta()[topic].study)
    .slice(0, 6);
}

function getWeakTopicLabels() {
  if (!state.weakTopicKeys.length) return "пока нет данных";
  return state.weakTopicKeys.map((topic) => getTopicMeta()[topic].title).join(", ");
}

function getRecommendedCourse() {
  if (state.mode === "de") return courses.dePracticum;
  if (!state.completed) return courses.sqlFoundation;

  const advancedTopics = ["windows", "dates", "cte", "subqueries"];
  const advancedWeak = state.weakTopicKeys.some((topic) => advancedTopics.includes(topic));
  const broadWeakness = state.weakTopicKeys.length >= 3;
  const advancedAverage = Math.round(
    advancedTopics.reduce((sum, topic) => sum + (state.topicScores[topic] || 0), 0) / advancedTopics.length
  );

  if (state.score < 55) return courses.sqlFoundation;
  if (state.score < 68) return courses.sqlJunior;
  if (state.score < 78 && broadWeakness) return courses.sqlJuniorMiddleProgram;
  if (state.score >= 86 && advancedAverage >= 70) return courses.sqlUpperMiddleProgram;
  if (state.score >= 78 && advancedWeak) return courses.sqlMiddle;
  if (state.score >= 78) return courses.sqlUpperMiddleProgram;
  return courses.sqlJuniorMiddleProgram;
}

function buildResultText() {
  if (!state.completed) return "Диагностика еще не завершена.";

  const course = getRecommendedCourse();
  const study = getStudyItems().map((item) => `- ${item}`).join("\n");

  return [
    `${getConfig().label}-диагностика`,
    `Готовность: ${state.score}%`,
    `Слабые зоны: ${getWeakTopicLabels()}`,
    "",
    "Что выучить и на что обратить внимание:",
    study,
    "",
    `Рекомендованный маршрут: ${course.title}`,
    course.url,
  ].join("\n");
}

async function copyResult() {
  if (!state.completed) return;

  const text = buildResultText();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    els.resultStatus.textContent = "Результат скопирован.";
  } catch {
    fallbackCopy(text);
    els.resultStatus.textContent = "Результат скопирован через fallback.";
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function switchMode(mode) {
  if (!tests[mode] || mode === state.mode) return;
  activeMode = mode;
  state = createState(activeMode);
  renderModeButtons();
  renderQuestion();
  renderInitialResult();
}

function renderModeButtons() {
  els.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
}

function resetDiagnostic() {
  state = createState(state.mode);
  els.resultStatus.textContent = "";
  els.copyResult.disabled = true;
  renderModeButtons();
  renderQuestion();
  renderInitialResult();
}

function renderInitialResult() {
  const config = getConfig();
  const course = getRecommendedCourse();
  els.score.textContent = "0%";
  els.score.style.setProperty("--score", "0%");
  els.diagnosisTitle.textContent = `Результат появится после ${config.label}-ответов`;
  els.diagnosisCopy.textContent = "Результат считается только после подтверждения ответа. Обычный клик пока ничего не засчитывает.";
  els.studyList.innerHTML = `<li>Ответь на вопросы ${config.label}-диагностики, и здесь появятся конкретные слабые места.</li>`;
  els.courseTitle.textContent = "Сначала диагностика";
  els.courseCopy.textContent = "Ссылка на маршрут появится после результата.";
  els.courseLink.href = course.url;
  els.courseLink.textContent = state.mode === "de" ? "Открыть лендинг DE" : "Открыть курс";
}

els.next.addEventListener("click", handlePrimaryAction);
els.restart.addEventListener("click", resetDiagnostic);
els.copyResult.addEventListener("click", copyResult);
els.modeButtons.forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.mode));
});

renderModeButtons();
renderQuestion();
renderInitialResult();
