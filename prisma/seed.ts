import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env["DATABASE_URL"] || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const name of ["张三", "李四", "王五"]) {
    await prisma.user.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("Users created: 张三, 李四, 王五");

  const menus: { date: string; lunch: string; dinner: string }[] = [
    { date: "2026-02-09", lunch: "红烧肉、清炒时蔬、番茄蛋汤", dinner: "宫保鸡丁、蒜蓉西兰花、紫菜蛋花汤" },
    { date: "2026-02-10", lunch: "糖醋里脊、炒青菜、冬瓜排骨汤", dinner: "鱼香肉丝、爝炒土豆丝、豆腐汤" },
    { date: "2026-02-11", lunch: "回锅肉、干煸四季豆、酸辣汤", dinner: "红烧鱼块、清炒豆芽、玉米排骨汤" },
    { date: "2026-02-12", lunch: "麻婆豆腐、蒜薹炒肉、西红柿蛋汤", dinner: "辣子鸡、凉拌黄瓜、紫菜虾皮汤" },
    { date: "2026-02-13", lunch: "黄焖鸡、素炒三丁、萝卜牛腩汤", dinner: "水煮肉片、蒜蓉菠菜、银耳莲子羹" },
    { date: "2026-02-14", lunch: "可乐鸡翅、醋溜白菜、南瓜粥", dinner: "烤鸭腿、炒豆角、山药排骨汤" },
    { date: "2026-02-15", lunch: "咖喱牛肉、清炒荷兰豆、蘑菇汤", dinner: "酸菜鱼、拍黄瓜、红枣桂圆汤" },
  ];

  for (const menu of menus) {
    const date = new Date(menu.date + "T00:00:00.000Z");
    await prisma.weeklyMenu.upsert({
      where: { date_mealType: { date, mealType: "lunch" } },
      update: { dishes: menu.lunch },
      create: { date, mealType: "lunch", dishes: menu.lunch },
    });
    await prisma.weeklyMenu.upsert({
      where: { date_mealType: { date, mealType: "dinner" } },
      update: { dishes: menu.dinner },
      create: { date, mealType: "dinner", dishes: menu.dinner },
    });
  }
  console.log("Weekly menus created: 2026-02-09 ~ 2026-02-15");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
