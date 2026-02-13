import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env["DATABASE_URL"] || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create admin user
  const admin = await prisma.user.upsert({
    where: { name: "管理员" },
    update: {},
    create: { name: "管理员", role: "admin" },
  });

  // Create regular users
  const zhangsan = await prisma.user.upsert({
    where: { name: "张三" },
    update: {},
    create: { name: "张三" },
  });
  const lisi = await prisma.user.upsert({
    where: { name: "李四" },
    update: {},
    create: { name: "李四" },
  });
  const wangwu = await prisma.user.upsert({
    where: { name: "王五" },
    update: {},
    create: { name: "王五" },
  });

  console.log("Users created:", { admin, zhangsan, lisi, wangwu });

  // Create today's date (normalized to midnight)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Create lunch menu
  const lunch = await prisma.dailyMenu.upsert({
    where: { date_mealType: { date: today, mealType: "lunch" } },
    update: {},
    create: {
      date: today,
      mealType: "lunch",
      items: {
        create: [
          { name: "宫保鸡丁", price: 18.0, description: "经典川菜，鸡肉搭配花生米" },
          { name: "番茄炒蛋", price: 12.0, description: "家常菜，酸甜可口" },
          { name: "红烧肉", price: 22.0, description: "五花肉慢炖，肥而不腻" },
          { name: "清炒时蔬", price: 10.0, description: "当季新鲜蔬菜" },
          { name: "酸辣土豆丝", price: 10.0, description: "开胃下饭" },
        ],
      },
    },
  });

  // Create dinner menu
  const dinner = await prisma.dailyMenu.upsert({
    where: { date_mealType: { date: today, mealType: "dinner" } },
    update: {},
    create: {
      date: today,
      mealType: "dinner",
      items: {
        create: [
          { name: "麻婆豆腐", price: 15.0, description: "麻辣鲜香，下饭神器" },
          { name: "糖醋里脊", price: 20.0, description: "外酥里嫩，酸甜适中" },
          { name: "鱼香肉丝", price: 18.0, description: "经典川菜，咸甜酸辣" },
          { name: "蒜蓉西兰花", price: 12.0, description: "健康营养，清淡爽口" },
          { name: "小炒黄牛肉", price: 25.0, description: "鲜嫩多汁，香辣可口" },
        ],
      },
    },
  });

  console.log("Menus created:", { lunch, dinner });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

