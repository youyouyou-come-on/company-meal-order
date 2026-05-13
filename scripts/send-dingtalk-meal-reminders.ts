import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { businessDateToUtcDate, getChinaTodayString } from "../src/lib/china-date";
import {
  getDingtalkAccessToken,
  loadDingtalkConfigFromEnv,
  sendDingtalkWorkNotice,
} from "../src/lib/dingtalk";

type ReminderRound = "first" | "second";

const MIN_SUBMITTED_USERS_FOR_REMINDER = 5;

type ReminderTarget = {
  id: number;
  name: string;
  dingtalkUserId: string | null;
  signups: Array<{ mealType: string }>;
};

const adapter = new PrismaBetterSqlite3({
  url: process.env["DATABASE_URL"] || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

function parseArgs() {
  const args = process.argv.slice(2);
  const getValue = (name: string) => {
    const prefix = `--${name}=`;
    const matched = args.find((arg) => arg.startsWith(prefix));
    return matched ? matched.slice(prefix.length).trim() : "";
  };

  const roundValue = getValue("round");
  const round: ReminderRound = roundValue === "second" ? "second" : "first";

  return {
    date: getValue("date") || getChinaTodayString(),
    name: getValue("name"),
    round,
    live: args.includes("--live"),
  };
}

function buildReminderContent(employeeName: string, round: ReminderRound, date: string) {
  const url = process.env["DINGTALK_REMINDER_URL"]?.trim() || "https://meal.zcgc.club";
  const title = round === "second" ? "点餐二次提醒" : "点餐提醒";
  const suffix =
    round === "second"
      ? "系统 9 点 50 再次检查到你今天还没有提交点餐。"
      : "系统 9 点半检查到你今天还没有提交点餐。";

  return `${title}\n\n${employeeName}，${suffix}\n\n请点击进入：${url}\n\n如果你今天不吃，也请进入系统明确提交，避免重复提醒。\n\n日期：${date}`;
}

async function findActiveUsersWithSignups(date: string) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: {
      signups: {
        where: { date: businessDateToUtcDate(date) },
        select: { mealType: true },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return users as ReminderTarget[];
}

function getReminderTargets(users: ReminderTarget[]) {
  return users.filter((user) => user.signups.length === 0);
}

function getSubmittedUserCount(users: ReminderTarget[]) {
  return users.filter((user) => user.signups.length > 0).length;
}

async function main() {
  const { date, name, round, live } = parseArgs();
  const { config, missing } = loadDingtalkConfigFromEnv();
  const activeUsers = await findActiveUsersWithSignups(date);
  const submittedUserCount = getSubmittedUserCount(activeUsers);
  const targets = getReminderTargets(activeUsers).filter((target) =>
    name ? target.name === name : true
  );
  const sendableTargets = targets.filter((target) => target.dingtalkUserId);
  const unboundTargets = targets.filter((target) => !target.dingtalkUserId);

  console.log(`点餐提醒检查日期：${date}`);
  if (name) console.log(`指定员工：${name}`);
  console.log(`提醒轮次：${round === "second" ? "9 点 50 二次提醒" : "9 点半首次提醒"}`);
  console.log(`运行模式：${live ? "live，可能真实发送钉钉工作通知" : "dry-run，只打印不发送"}`);
  console.log(`今天已提交点餐员工人数：${submittedUserCount}`);
  console.log(`未提交点餐人数：${targets.length}`);
  console.log(`已绑定钉钉 UserId，可发送人数：${sendableTargets.length}`);
  console.log(`未绑定钉钉 UserId，跳过人数：${unboundTargets.length}`);

  if (!name && submittedUserCount < MIN_SUBMITTED_USERS_FOR_REMINDER) {
    console.log(
      `今天已点餐员工少于 ${MIN_SUBMITTED_USERS_FOR_REMINDER} 人，可能是休假日，本轮不发送提醒。`
    );
    return;
  }

  if (unboundTargets.length > 0) {
    console.log(`未绑定人员：${unboundTargets.map((target) => target.name).join("、")}`);
  }

  if (!live) {
    for (const target of sendableTargets) {
      console.log("---");
      console.log(`模拟发送给：${target.name} (${target.dingtalkUserId})`);
      console.log(buildReminderContent(target.name, round, date));
    }
    return;
  }

  if (missing.length > 0) {
    throw new Error(`缺少钉钉环境变量：${missing.join("、")}`);
  }

  if (sendableTargets.length === 0) {
    console.log("没有可发送对象，已结束。");
    return;
  }

  const accessToken = await getDingtalkAccessToken(config);
  for (const target of sendableTargets) {
    await sendDingtalkWorkNotice(config, accessToken, {
      userId: target.dingtalkUserId as string,
      content: buildReminderContent(target.name, round, date),
    });
    console.log(`已发送：${target.name}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
