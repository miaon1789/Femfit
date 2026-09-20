-- Apply after 002_food_discovery.sql. Additive, rerunnable: never deletes existing foods.

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '番茄鸡蛋面（参考配方）','Tomato and egg noodles (recipe estimate)',ARRAY['西红柿鸡蛋面','番茄面']::text[],'外食',1,'份',419,16.7,56.3,11.9,4.2,0.9,'FemFit recipe estimate','面条（煮） 200g + 番茄 150g + 鸡蛋 1个 + 食用油 5ml'
where not exists (select 1 from public.food_database where name='番茄鸡蛋面（参考配方）');

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '鸡丝凉面（参考配方）','Cold chicken noodles (recipe estimate)',ARRAY['鸡丝面','凉面']::text[],'外食',1,'份',469.3,35.2,53.4,9.8,2.8,0.8,'FemFit recipe estimate','面条（煮） 200g + 鸡胸肉（熟） 80g + 黄瓜 80g + 酱油 10ml + 食用油 5ml'
where not exists (select 1 from public.food_database where name='鸡丝凉面（参考配方）');

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '虾仁炒饭（参考配方）','Shrimp fried rice (recipe estimate)',ARRAY['虾炒饭']::text[],'外食',1,'份',465.9,31,55.4,13.7,1.4,1.9,'FemFit recipe estimate','米饭 200g + 虾 80g + 鸡蛋 1个 + 胡萝卜 30g + 食用油 8ml'
where not exists (select 1 from public.food_database where name='虾仁炒饭（参考配方）');

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '鸡胸肉沙拉（参考配方）','Chicken salad (recipe estimate)',ARRAY['鸡肉沙拉','减脂沙拉']::text[],'外食',1,'份',280.4,39.6,8.3,9.7,2.4,1.6,'FemFit recipe estimate','鸡胸肉（熟） 120g + 生菜 80g + 番茄 80g + 黄瓜 80g + 食用油 5ml'
where not exists (select 1 from public.food_database where name='鸡胸肉沙拉（参考配方）');

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '鸡蛋三明治（参考配方）','Egg sandwich (recipe estimate)',ARRAY['蛋三明治']::text[],'外食',1,'份',252.6,13.2,32.3,7.8,4.8,2.8,'FemFit recipe estimate','全麦面包 70g + 鸡蛋 1个 + 生菜 20g + 番茄 30g'
where not exists (select 1 from public.food_database where name='鸡蛋三明治（参考配方）');

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '金枪鱼三明治（参考配方）','Tuna sandwich (recipe estimate)',ARRAY['吞拿鱼三明治']::text[],'外食',1,'份',286.2,29.3,31.9,4.1,4.8,2.7,'FemFit recipe estimate','全麦面包 70g + 金枪鱼 80g + 生菜 20g + 番茄 30g'
where not exists (select 1 from public.food_database where name='金枪鱼三明治（参考配方）');

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '牛油果鸡蛋吐司（参考配方）','Avocado egg toast (recipe estimate)',ARRAY['牛油果蛋吐司']::text[],'外食',1,'份',238.1,10.5,20,13.8,5.6,2.1,'FemFit recipe estimate','全麦面包 35g + 牛油果 50g + 鸡蛋 1个'
where not exists (select 1 from public.food_database where name='牛油果鸡蛋吐司（参考配方）');

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '酸奶燕麦碗（参考配方）','Yogurt oat bowl (recipe estimate)',ARRAY['酸奶碗','燕麦碗']::text[],'外食',1,'份',278.1,11,47.7,4.8,4.7,1.4,'FemFit recipe estimate','原味酸奶 150g + 燕麦（干） 30g + 香蕉 60g'
where not exists (select 1 from public.food_database where name='酸奶燕麦碗（参考配方）');

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '蓝莓希腊酸奶碗（参考配方）','Blueberry Greek yogurt bowl (recipe estimate)',ARRAY['希腊酸奶碗']::text[],'外食',1,'份',257,17.8,17.2,13.7,2.6,0.4,'FemFit recipe estimate','希腊酸奶 170g + 蓝莓 60g + 杏仁 10g'
where not exists (select 1 from public.food_database where name='蓝莓希腊酸奶碗（参考配方）');

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '豆腐蔬菜汤（参考配方）','Tofu vegetable soup (recipe estimate)',ARRAY['豆腐汤','蔬菜豆腐汤']::text[],'外食',1,'份',129.4,10.6,7.6,7.4,1.5,2.6,'FemFit recipe estimate','嫩豆腐 150g + 白菜 100g + 蘑菇 50g + 食用油 3ml'
where not exists (select 1 from public.food_database where name='豆腐蔬菜汤（参考配方）');

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '鸡胸肉盖饭（参考配方）','Chicken rice bowl (recipe estimate)',ARRAY['鸡肉饭','鸡胸盖饭']::text[],'外食',1,'份',455.3,44.8,46.4,10.2,3.1,2.3,'FemFit recipe estimate','米饭 150g + 鸡胸肉（熟） 120g + 西兰花 100g + 酱油 10ml + 食用油 5ml'
where not exists (select 1 from public.food_database where name='鸡胸肉盖饭（参考配方）');

insert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)
select '三文鱼饭碗（参考配方）','Salmon rice bowl (recipe estimate)',ARRAY['三文鱼盖饭']::text[],'外食',1,'份',444.3,25.8,44.2,18,2.9,1.7,'FemFit recipe estimate','米饭 150g + 三文鱼 100g + 黄瓜 60g + 牛油果 30g + 酱油 10ml'
where not exists (select 1 from public.food_database where name='三文鱼饭碗（参考配方）');
